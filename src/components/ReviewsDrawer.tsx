import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useUserReviews } from '@/hooks/useReviews';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface ReviewsDrawerProps {
  userId: string;
  username: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function FilledStarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className="text-sm" style={star > rating ? { color: '#d1d5db' } : undefined}>
          {star <= rating ? '⭐' : '★'}
        </span>
      ))}
    </div>
  );
}

function ReviewsDrawer({ userId, username, open, onOpenChange }: ReviewsDrawerProps) {
  const { data: reviews, isLoading } = useUserReviews(userId);
  const navigate = useNavigate();
  
  const averageRating = reviews && reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null;
  
  const displayUsername = username.startsWith('@') ? username : `@${username}`;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85dvh]">
        <div className="overflow-y-auto">
          <DrawerHeader className="text-center pb-4">
            <DrawerTitle className="text-xl font-semibold">
              {displayUsername} reviews
            </DrawerTitle>
            {averageRating && (
              <div className="flex justify-center mt-2">
                <div className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1 card-shadow">
                  <span className="text-sm">⭐</span>
                  <span className="text-sm font-medium text-foreground">
                    {averageRating}/5
                  </span>
                </div>
              </div>
            )}
          </DrawerHeader>

          <div className="px-4 pb-8 space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <span className="text-4xl">⏳</span>
              </div>
            ) : reviews && reviews.length > 0 ? (
              reviews.map((review) => {
                const reviewerUsername = review.reviewer_profile?.username || '@user';
                const displayReviewerName = reviewerUsername.startsWith('@') 
                  ? reviewerUsername 
                  : `@${reviewerUsername}`;
                const reviewerAvatar = review.reviewer_profile?.avatar_url || '';
                const reviewerUserId = review.reviewer_profile?.user_id || review.reviewer_id;
                const formattedDate = format(new Date(review.created_at), 'dd/MM/yyyy');
                const listingImage = review.order?.listing?.images?.[0];
                const roleLabel = review.reviewer_role === 'buyer' ? 'Buyer' : review.reviewer_role === 'seller' ? 'Seller' : null;

                return (
                  <div key={review.id} className="rounded-xl bg-card p-4 card-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            onOpenChange(false);
                            navigate(`/seller/${reviewerUserId}`);
                          }}
                          className="shrink-0"
                        >
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={reviewerAvatar} alt={displayReviewerName} />
                            <AvatarFallback>
                              {reviewerUsername.replace('@', '').charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </button>
                        <div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                onOpenChange(false);
                                navigate(`/seller/${reviewerUserId}`);
                              }}
                              className="font-medium text-foreground hover:underline text-left"
                            >
                              {displayReviewerName}
                            </button>
                            {roleLabel && (
                              <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                                {roleLabel}
                              </span>
                            )}
                          </div>
                          <FilledStarRating rating={review.rating} />
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">{formattedDate}</span>
                    </div>
                    
                    {review.comment && (
                      <p className="text-foreground mt-3">{review.comment}</p>
                    )}
                    
                    {listingImage && (
                      <div className="mt-3">
                        <img
                          src={listingImage}
                          alt="Product"
                          className="h-16 w-16 rounded-lg object-cover"
                        />
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <span className="text-4xl mb-2">📝</span>
                <p className="text-muted-foreground">No reviews yet</p>
              </div>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export default ReviewsDrawer;

