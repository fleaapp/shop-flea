import { useNavigate } from 'react-router-dom';
import { formatTagLabel } from '@/components/ListingTag';

interface ProfileGridCardProps {
  listing: {
    id: string;
    title: string;
    brand: string;
    size: string;
    price: number;
    shipping_price: number | null;
    images: string[];
    source_listing_id?: string;
    order_id?: string;
  };
  activeTab: 'listings' | 'sold';
  getOrderStatusButton?: (listingId: string, orderId?: string) => React.ReactNode;
}

const ProfileGridCard = ({ listing, activeTab, getOrderStatusButton }: ProfileGridCardProps) => {
  const navigate = useNavigate();

  return (
    <div className="w-full cursor-pointer" onClick={() => {
      const rawId = (listing as any).source_listing_id || listing.id;
      const realId = typeof rawId === 'string' && rawId.includes('::') ? rawId.split('::')[0] : rawId;
      navigate(`/listing/${realId}`);
    }}>
      <div className="flex flex-col overflow-hidden rounded-2xl bg-card p-2 card-shadow">
        {/* Image */}
        <div className="relative aspect-[4/5] overflow-hidden rounded-xl">
          <img
            src={listing.images[0]}
            alt={listing.title}
            className="h-full w-full object-cover block rounded-xl"
          />

          {/* Edit button - only for active listings */}
          {activeTab === 'listings' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/listing/${listing.id}/edit`);
              }}
              className="absolute top-1.5 right-1.5 h-7 w-7 flex items-center justify-center rounded-full bg-card/90 backdrop-blur-sm hover:bg-card z-10 text-xs"
            >
              ✏️
            </button>
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
              <p className="text-[10px] text-muted-foreground">📦 +${listing.shipping_price || 0}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileGridCard;
