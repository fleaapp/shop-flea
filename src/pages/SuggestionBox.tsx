import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const SuggestionBox = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Please log in to submit a suggestion');
      return;
    }

    const trimmed = content.trim();
    if (!trimmed) {
      toast.error('Please enter your suggestion');
      return;
    }
    if (trimmed.length > 2000) {
      toast.error('Suggestion must be under 2000 characters');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('suggestions' as any)
        .insert({ user_id: user.id, content: trimmed } as any);

      if (error) throw error;

      toast.success('Thank you! Your suggestion has been submitted 💌');
      setContent('');
      navigate(-1);
    } catch {
      toast.error('Failed to submit suggestion. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background px-4 py-4 flex items-center">
        <button onClick={() => navigate(-1)} className="p-1">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-foreground flex-1 text-center pr-6">📮 Suggestion Box</h1>
      </header>

      <div className="px-6 pt-8 flex flex-col items-center text-center max-w-[300px] mx-auto">
        <h2 className="text-lg font-bold text-foreground mb-3">
          Help shape the future of Flea
        </h2>

        <p className="text-xs text-muted-foreground mb-8 leading-relaxed">
          We're building Flea alongside our community. If there's a feature you want, something that feels clunky, or an idea you can't stop thinking about… tell us!
        </p>

        <Textarea
          placeholder="Share your idea here… What would you love to see added or improved in Flea?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[160px] rounded-2xl bg-card border-border text-foreground placeholder:text-muted-foreground placeholder:pt-2 resize-none w-full mb-6"
          maxLength={2000}
        />

        <Button
          onClick={handleSubmit}
          disabled={submitting || !content.trim()}
          className="rounded-full h-12 px-8 bg-foreground text-background font-bold text-sm hover:bg-foreground/90"
        >
          📬 Submit
        </Button>
      </div>
    </div>
  );
};

export default SuggestionBox;
