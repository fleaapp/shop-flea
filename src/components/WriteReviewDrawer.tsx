import { useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useCreateReview } from '@/hooks/useReviews';
import { toast } from 'sonner';

interface WriteReviewDrawerProps {
  orderId: string;
  reviewedUserId: string;
  reviewedUsername: string;
  reviewType: 'seller' | 'buyer';
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function StarRatingInput({ rating, onChange }: { rating: number; onChange: (rating: number) => void }) {
  const [hoverRating, setHoverRating] = useState(0);
  
  return (
    <div className="flex gap-2 justify-center">
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= (hoverRating || rating);
        return (
          <button
            key={star}
            type="button"
            className="text-4xl transition-transform hover:scale-110 focus:outline-none"
            style={!active ? { color: '#d1d5db' } : undefined}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            onClick={() => onChange(star)}
          >
            {active ? '⭐' : '★'}
          </button>
        );
      })}
    </div>
  );
}

function WriteReviewDrawer({
  orderId,
  reviewedUserId,
  reviewedUsername,
  reviewType,
  open,
  onOpenChange,
}: WriteReviewDrawerProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const createReview = useCreateReview();
  
  const displayUsername = reviewedUsername.startsWith('@') 
    ? reviewedUsername 
    : `@${reviewedUsername}`;

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }
    
    try {
      await createReview.mutateAsync({
        orderId,
        reviewedUserId,
        rating,
        comment,
      });
      
      toast.success('Review submitted!');
      setRating(0);
      setComment('');
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to submit review');
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setRating(0);
      setComment('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="max-h-[90dvh]">
        <div className="overflow-y-auto">
          <DrawerHeader className="text-center pb-4">
            <DrawerTitle className="text-xl font-semibold">
              Review {reviewType === 'seller' ? 'Seller' : 'Buyer'}
            </DrawerTitle>
            <p className="text-muted-foreground mt-1">{displayUsername}</p>
          </DrawerHeader>

          <div className="px-4 pb-8 space-y-6">
            {/* Star Rating */}
            <div className="rounded-xl bg-card p-6 card-shadow">
              <p className="text-center font-medium text-foreground mb-4">
                How was your experience?
              </p>
              <StarRatingInput rating={rating} onChange={setRating} />
              {rating > 0 && (
                <p className="text-center text-muted-foreground mt-2">
                  {rating === 1 && 'Poor'}
                  {rating === 2 && 'Fair'}
                  {rating === 3 && 'Good'}
                  {rating === 4 && 'Great'}
                  {rating === 5 && 'Excellent'}
                </p>
              )}
            </div>

            {/* Comment */}
            <div className="rounded-xl bg-card p-4 card-shadow">
              <p className="font-medium text-foreground mb-3">Add a comment (optional)</p>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your experience..."
                className="bg-background min-h-[100px] resize-none"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground mt-2 text-right">
                {comment.length}/500
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex flex-col items-center pt-4">
              <Button
                onClick={handleSubmit}
                disabled={rating === 0 || createReview.isPending}
                className="rounded-full bg-charcoal text-white hover:bg-charcoal-light h-12 px-8 w-full max-w-xs"
              >
                {createReview.isPending ? 'Submitting...' : 'Submit Review'}
              </Button>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export default WriteReviewDrawer;
