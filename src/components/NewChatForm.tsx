import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface NewChatFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NewChatForm = ({ open, onOpenChange }: NewChatFormProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (!user || !title.trim() || !description.trim()) return;
    setSubmitting(true);

    try {
      let attachmentUrl: string | null = null;

      if (file) {
        const filePath = `${user.id}/support/${Date.now()}_${file.name}`;
        const { error: uploadErr } = await supabase.storage.from('listings').upload(filePath, file);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from('listings').getPublicUrl(filePath);
        attachmentUrl = urlData.publicUrl;
      }

      const { data: thread, error: threadErr } = await (supabase as any)
        .from('chat_threads')
        .insert({
          user_id: user.id,
          title: title.trim(),
          description: description.trim(),
          status: 'active',
        })
        .select()
        .single();

      if (threadErr) throw threadErr;

      const { error: msgErr } = await (supabase as any).from('chat_messages').insert({
        thread_id: thread.id,
        sender_id: user.id,
        sender_type: 'user',
        message: description.trim(),
        attachment_url: attachmentUrl,
        read: false,
      });

      if (msgErr) throw msgErr;

      toast.success('Support chat created');
      onOpenChange(false);
      setTitle('');
      setDescription('');
      setFile(null);
      navigate(`/contact-support/${thread.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create chat');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-8">
        <DrawerHeader>
          <DrawerTitle className="text-lg font-bold">New Support Chat</DrawerTitle>
        </DrawerHeader>

        <div className="px-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Title</label>
            <Input
              placeholder="e.g. Issue with my order"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Description</label>
            <Textarea
              placeholder="Describe your issue..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-sm text-muted-foreground flex items-center gap-1.5"
            >
              📎 {file ? file.name : 'Attach a file'}
            </button>
          </div>

          <div className="flex justify-center">
            <Button
              onClick={handleSubmit}
              disabled={submitting || !title.trim() || !description.trim()}
              className="w-48 rounded-full bg-charcoal text-card font-bold hover:bg-charcoal/90 h-12"
            >
              {submitting ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default NewChatForm;
