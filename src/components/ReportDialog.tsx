import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reason: string) => void;
  isSubmitting: boolean;
  reportType: 'listing' | 'comment' | 'user';
}

const labels: Record<string, string> = {
  listing: 'listing',
  comment: 'comment',
  user: 'user',
};

const ReportDialog = ({ open, onOpenChange, onSubmit, isSubmitting, reportType }: ReportDialogProps) => {
  const [reason, setReason] = useState('');

  const handleSubmit = () => {
    if (!reason.trim()) return;
    onSubmit(reason.trim());
    setReason('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setReason(''); }}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Report {labels[reportType]}</DialogTitle>
          <DialogDescription>
            Tell us why you're reporting this {labels[reportType]}. We'll review it shortly.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder={`Why are you reporting this ${labels[reportType]}?`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="min-h-[100px] resize-none rounded-xl"
          maxLength={500}
        />
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!reason.trim() || isSubmitting}
            className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isSubmitting ? 'Submitting…' : 'Submit Report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReportDialog;
