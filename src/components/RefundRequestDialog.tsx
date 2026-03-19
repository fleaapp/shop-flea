import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Image, X, Loader2 } from 'lucide-react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { compressImage } from '@/utils/imageCompression';
import { toast } from 'sonner';

const REFUND_REASONS = [
  'Item not as described',
  'Item damaged during shipping',
  'Wrong item received',
  'Item never arrived',
  'Quality not as expected',
  'Other',
];

interface RefundRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  userId: string;
  onSubmit: (data: { reason: string; details: string; imageUrls: string[] }) => Promise<void>;
}

const RefundRequestDialog = ({ open, onOpenChange, orderId, userId, onSubmit }: RefundRequestDialogProps) => {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newImages = files.slice(0, 5 - images.length).map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setImages(prev => [...prev, ...newImages]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeImage = (index: number) => {
    setImages(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const handleSubmit = async () => {
    if (!reason) {
      toast.error('Please select a reason for the refund');
      return;
    }

    setSubmitting(true);
    try {
      const imageUrls: string[] = [];

      for (const img of images) {
        const compressed = await compressImage(img.file);
        const ext = img.file.name.split('.').pop() || 'jpg';
        const path = `${userId}/${orderId}/refund-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await cloudSupabase.storage.from('order-attachments').upload(path, compressed);

        if (uploadError) {
          throw new Error(uploadError.message || 'Image upload failed');
        }

        const { data: urlData } = cloudSupabase.storage.from('order-attachments').getPublicUrl(path);
        imageUrls.push(urlData.publicUrl);
      }

      await onSubmit({ reason, details, imageUrls });

      setReason('');
      setDetails('');
      images.forEach(img => URL.revokeObjectURL(img.preview));
      setImages([]);
      onOpenChange(false);
    } catch (err) {
      console.error('Refund request error:', err);
      const message = err instanceof Error ? err.message : 'Failed to submit refund request';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg">Request Refund</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Reason for refund *</label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {REFUND_REASONS.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Additional details</label>
            <Textarea
              value={details}
              onChange={e => setDetails(e.target.value)}
              placeholder="Provide any additional details..."
              className="rounded-xl resize-none"
              rows={3}
              maxLength={2000}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Upload images (optional)</label>
            <div className="flex flex-wrap gap-2">
              {images.map((img, i) => (
                <div key={i} className="relative h-20 w-20 rounded-xl overflow-hidden bg-muted">
                  <img src={img.preview} alt="" className="h-full w-full object-cover" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              ))}
              {images.length < 5 && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="h-20 w-20 rounded-xl border-2 border-dashed border-muted-foreground/30 flex items-center justify-center hover:bg-muted/50 transition-colors"
                >
                  <Image className="h-5 w-5 text-muted-foreground" />
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageAdd} />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!reason || submitting}
            className="w-full rounded-full bg-charcoal text-white hover:bg-charcoal-light h-12"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit Request'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RefundRequestDialog;
