import { useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useUserReviews } from '@/hooks/useReviews';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { getDefaultAvatar } from '@/utils/defaultAvatars';

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

function PhotoLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[90vw] max-h-[90dvh] p-0 bg-black border-0 rounded-2xl overflow-hidden flex items-center justify-center">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 bg-black/60 rounded-full p-1.5 text-white"
        >
          <X className="h-5 w-5" />
        </button>
        <img
          src={src}
          alt="Review photo"
          className="max-w-full max-h-[85dvh] object-contain"
        />
      </DialogContent>
    </Dialog>
  );
}

function ReviewsDrawer({ userId, username, open, onOpenChange }: ReviewsDrawerProps) {
  const { data: reviews, isLoading } = useUserReviews(userId);
  const navigate = useNavigate();
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'buyer' | 'seller'>('all');
  
  const averageRating = reviews && reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null;
  
  const displayUsername = username.startsWith('@') ? username : `@${username}`;

  const filteredReviews = reviews?.filter(r => {
    if (activeTab === 'all') return true;
    return r.reviewer_role === activeTab;
  }) ?? [];

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85dvh]">
          <div className="overflow-y-auto">
            <DrawerHeader className="text-center pb-4">
              <DrawerTitle className="text-xl font-semibold text-center">
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
              {/* Buyer / Seller toggle */}
              <div className="flex justify-center mt-3">
                <div className="flex items-center rounded-full bg-muted p-1">
                  <button
                    onClick={() => setActiveTab('all')}
                    className={`rounded-full w-20 py-2.5 text-sm font-medium transition-all ${activeTab === 'all' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setActiveTab('buyer')}
                    className={`rounded-full w-20 py-2.5 text-sm font-medium transition-all ${activeTab === 'buyer' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
                  >
                    Buyer
                  </button>
                  <button
                    onClick={() => setActiveTab('seller')}
                    className={`rounded-full w-20 py-2.5 text-sm font-medium transition-all ${activeTab === 'seller' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
                  >
                    Seller
                  </button>
                </div>
              </div>
            </DrawerHeader>

            <div className="px-4 pb-8 space-y-4">
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <span className="text-4xl">⏳</span>
                </div>
              ) : filteredReviews.length > 0 ? (
                filteredReviews.map((review) => {
                  const reviewerUsername = review.reviewer_profile?.username || '@user';
                  const displayReviewerName = reviewerUsername.startsWith('@') 
                    ? reviewerUsername 
                    : `@${reviewerUsername}`;
                  const reviewerAvatar = review.reviewer_profile?.avatar_url || null;
                  const reviewerUserId = review.reviewer_profile?.user_id || review.reviewer_id;
                  const formattedDate = format(new Date(review.created_at), 'dd/MM/yyyy');
                  const listingImage = review.order?.listing?.images?.[0];
                  const listingId = review.order?.listing_id;
                  const roleLabel = review.reviewer_role === 'buyer' ? 'Buyer' : review.reviewer_role === 'seller' ? 'Seller' : null;

                  return (
                    <div
                      key={review.id}
                      className="rounded-xl bg-card p-4 card-shadow"
                      onClick={listingId ? () => {
                        onOpenChange(false);
                        navigate(`/listing/${listingId}`);
                      } : undefined}
                      style={listingId ? { cursor: 'pointer' } : undefined}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenChange(false);
                              navigate(`/seller/${reviewerUserId}`);
                            }}
                            className="shrink-0"
                          >
                             <Avatar className="h-10 w-10">
                              <AvatarImage src={reviewerAvatar || getDefaultAvatar(reviewerUserId)} alt={displayReviewerName} />
                              <AvatarFallback>
                                {reviewerUsername.replace('@', '').charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          </button>
                          <div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
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
                      
                      {(review.photo_url || listingImage) && (
                        <div className="mt-3 flex gap-2">
                          {review.photo_url && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLightboxSrc(review.photo_url!);
                              }}
                            >
                              <img
                                src={review.photo_url}
                                alt="Review photo"
                                className="h-16 w-16 rounded-lg object-cover"
                              />
                            </button>
                          )}
                          {listingImage && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLightboxSrc(listingImage);
                              }}
                            >
                              <img
                                src={listingImage}
                                alt="Product"
                                className="h-16 w-16 rounded-lg object-cover opacity-60"
                              />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <span className="text-4xl mb-2">📝</span>
                  <p className="text-muted-foreground">
                    {activeTab === 'all' ? 'No reviews yet' : `No ${activeTab} reviews yet`}
                  </p>
                </div>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {lightboxSrc && (
        <PhotoLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}
    </>
  );
}

export default ReviewsDrawer;
