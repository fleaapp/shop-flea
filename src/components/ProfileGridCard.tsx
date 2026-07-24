import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatTagLabel } from '@/components/ListingTag';
import { supabase } from '@/lib/supabase';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ProfileGridCardProps {
  listing: {
    id: string;
    title: string;
    brand: string;
    size: string;
    price: number;
    shipping_price: number | null;
    images: string[];
    thumbnails?: string[] | null;
    source_listing_id?: string;
    order_id?: string;
  };
  activeTab: 'listings' | 'sold';
  getOrderStatusButton?: (listingId: string, orderId?: string) => React.ReactNode;
}

const ProfileGridCard = ({ listing, activeTab, getOrderStatusButton }: ProfileGridCardProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const thumb = listing.thumbnails?.[0] || listing.images[0];
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('listings')
        .update({ status: 'removed' })
        .eq('id', listing.id);
      if (error) throw error;
      toast.success('🗑️ Listing removed');
      queryClient.invalidateQueries({ queryKey: ['user-listings'] });
      queryClient.invalidateQueries({ queryKey: ['listings'] });
    } catch (e) {
      console.error('Error removing listing:', e);
      toast.error('Failed to remove listing');
    } finally {
      setIsDeleting(false);
      setConfirmOpen(false);
    }
  };

  return (
    <div className="w-full cursor-pointer" onClick={() => {
      const rawId = (listing as any).source_listing_id || listing.id;
      const realId = typeof rawId === 'string' && rawId.includes('::') ? rawId.split('::')[0] : rawId;
      navigate(`/listing/${realId}`, activeTab === 'sold' ? { state: { isSold: true, orderId: (listing as any).order_id } } : undefined);
    }}>
      <div className="flex flex-col overflow-hidden rounded-2xl bg-card p-2 card-shadow">
        {/* Image */}
        <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-muted">
          <img
            src={thumb}
            alt={listing.title}
            className="h-full w-full object-cover block rounded-xl"
            loading="lazy"
            decoding="async"
          />

          {/* Action buttons - only for active listings */}
          {activeTab === 'listings' && (
            <div className="absolute top-1.5 right-1.5 flex items-center gap-1.5 z-10">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmOpen(true);
                }}
                className="h-7 w-7 flex items-center justify-center rounded-full bg-card/90 backdrop-blur-sm hover:bg-card text-xs"
                aria-label="Remove listing"
              >
                🗑️
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/listing/${listing.id}/edit`);
                }}
                className="h-7 w-7 flex items-center justify-center rounded-full bg-card/90 backdrop-blur-sm hover:bg-card text-xs"
                aria-label="Edit listing"
              >
                ✏️
              </button>
            </div>
          )}

          {/* Order status for sold items */}
          {activeTab === 'sold' && getOrderStatusButton?.(
            (listing as any).source_listing_id || listing.id,
            (listing as any).order_id
          )}
        </div>

        {/* Content */}
        <div className="px-1 pt-2 pb-1">
          <div className="flex items-end justify-between gap-1">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground truncate">{listing.title}</h3>
              <div className="mt-1 flex flex-nowrap gap-1 overflow-x-auto scrollbar-hide whitespace-nowrap">
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                  {formatTagLabel(listing.size, true)}
                </span>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                  {listing.brand}
                </span>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-foreground">${listing.price}</p>
              <p className="text-[10px] text-muted-foreground">✈️ +${listing.shipping_price || 0}</p>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent
          className="max-w-[280px] rounded-2xl p-5"
          onClick={(e) => e.stopPropagation()}
        >
          <AlertDialogHeader className="space-y-2">
            <AlertDialogTitle className="text-base text-center">Remove listing?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-center leading-relaxed">
              This will hide your listing&nbsp;and<br />mark it as removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 sm:flex-row">
            <AlertDialogCancel className="flex-1 mt-0 h-9 rounded-lg text-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.stopPropagation(); handleDelete(); }}
              disabled={isDeleting}
              className="flex-1 h-9 rounded-lg text-sm bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeleting ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProfileGridCard;
