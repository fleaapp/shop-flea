import { useState, useRef } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useCreateReview } from '@/hooks/useReviews';
import { toast } from 'sonner';
import { Camera, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { compressImage } from '@/utils/imageCompression';

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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const createReview = useCreateReview();
  const { user } = useAuth();
  
  const displayUsername = reviewedUsername.startsWith('@') 
    ? reviewedUsername 
    : `@${reviewedUsername}`;

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.8 });
    setPhotoFile(compressed);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(compressed);
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }
    
    try {
      let photoUrl: string | undefined;

      if (photoFile && user) {
        setUploadingPhoto(true);
        try {
          const ext = photoFile.name.split('.').pop() || 'jpg';
          const path = `${user.id}/reviews/${Date.now()}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from('listings')
            .upload(path, photoFile, { upsert: true });
          if (uploadError) {
            console.warn('Photo upload failed, submitting review without photo:', uploadError);
          } else {
            const { data: urlData } = supabase.storage.from('listings').getPublicUrl(path);
            photoUrl = urlData.publicUrl;
          }
        } finally {
          setUploadingPhoto(false);
        }
      }

      await createReview.mutateAsync({
        orderId,
        reviewedUserId,
        rating,
        comment,
        photoUrl,
      });
      
      toast.success('Review submitted!');
      setRating(0);
      setComment('');
      setPhotoFile(null);
      setPhotoPreview(null);
      onOpenChange(false);
    } catch (error: unknown) {
      console.error('Review submission error:', error);
      const msg = error instanceof Error ? error.message : (typeof error === 'object' && error !== null && 'message' in error ? String((error as { message: unknown }).message) : 'Unknown error');
      toast.error(`Failed to submit review: ${msg}`);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setRating(0);
      setComment('');
      setPhotoFile(null);
      setPhotoPreview(null);
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

            {/* Photo Upload */}
            <div className="rounded-xl bg-card p-4 card-shadow">
              <p className="font-medium text-foreground mb-3">Add a photo (optional)</p>
              {photoPreview ? (
                <div className="relative inline-block">
                  <img
                    src={photoPreview}
                    alt="Review photo"
                    className="h-24 w-24 rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 rounded-full border border-border text-muted-foreground hover:bg-muted transition-colors text-sm"
                >
                  <Camera className="h-4 w-4" />
                  Upload photo
                </button>
              )}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoSelect}
              />
            </div>

            {/* Submit Button */}
            <div className="flex flex-col items-center pt-4">
              <Button
                onClick={handleSubmit}
                disabled={rating === 0 || createReview.isPending || uploadingPhoto}
                className="rounded-full bg-charcoal text-white hover:bg-charcoal-light h-12 px-8 w-40"
              >
                {createReview.isPending || uploadingPhoto ? 'Submitting...' : 'Submit Review'}
              </Button>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export default WriteReviewDrawer;

