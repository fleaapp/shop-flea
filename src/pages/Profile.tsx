import { Plus, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import BottomNav from '@/components/BottomNav';
import { useAuth } from '@/context/AuthContext';
import { useUserListings } from '@/hooks/useListings';
import { formatTagLabel } from '@/components/ListingTag';

const Profile = () => {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'listings' | 'sold'>('listings');
  
  const { listings: activeListings, loading: activeLoading } = useUserListings('active');
  const { listings: soldListings, loading: soldLoading } = useUserListings('sold');

  const displayListings = activeTab === 'listings' ? activeListings : soldListings;
  const isLoading = activeTab === 'listings' ? activeLoading : soldLoading;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background pb-24 flex flex-col items-center justify-center px-4">
        <p className="text-lg font-medium text-foreground mb-4">Sign in to view your profile</p>
        <button
          onClick={() => navigate('/auth')}
          className="rounded-full bg-primary px-6 py-3 text-primary-foreground font-medium"
        >
          Sign In
        </button>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background pb-24 overflow-hidden flex flex-col" style={{ touchAction: 'pan-x', overscrollBehavior: 'none' }}>
      <div className="flex flex-col items-center px-4 pt-6">
        <div className="relative">
          <div className="h-20 w-20 max-[430px]:h-16 max-[430px]:w-16 max-[375px]:h-14 max-[375px]:w-14 rounded-full p-0.5 bg-gradient-to-br from-muted to-border">
            <img src={profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`} alt="Profile" className="h-full w-full rounded-full bg-card object-cover" />
          </div>
        </div>
        <h2 className="mt-3 text-lg max-[430px]:text-base font-semibold text-foreground">{profile?.username || '@user'}</h2>
        <div className="mt-2 flex items-center gap-1.5 rounded-full bg-card px-3 py-1 card-shadow">
          <span className="text-sm">⭐</span>
          <span className="text-sm font-medium text-foreground">
            {profile?.rating && profile.rating > 0 ? `${profile.rating}/5` : 'No reviews'}
          </span>
        </div>
      </div>

      <div className="mt-5 max-[430px]:mt-4 max-[393px]:mt-3 max-[375px]:mt-2 flex justify-center items-center gap-2">
        <button 
          onClick={() => navigate('/create')} 
          className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground"
        >
          <Plus className="h-5 w-5" />
        </button>
        <div className="flex items-center rounded-full bg-muted p-1">
          <button onClick={() => setActiveTab('listings')} className={`rounded-full w-24 py-2.5 text-sm font-medium transition-all ${activeTab === 'listings' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
            Listings
          </button>
          <button onClick={() => setActiveTab('sold')} className={`rounded-full w-24 py-2.5 text-sm font-medium transition-all ${activeTab === 'sold' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
            Sold
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col justify-center overflow-x-auto overflow-y-hidden snap-x snap-mandatory scrollbar-hide py-6 max-[430px]:py-5 max-[393px]:py-4 max-[375px]:py-3" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : displayListings.length > 0 ? (
          <div className="flex gap-4 max-[430px]:gap-3 max-[375px]:gap-2.5" style={{ paddingLeft: 'calc(50% - min(128px, 35vw))', paddingRight: 'calc(50% - min(128px, 35vw))' }}>
            {displayListings.map((listing) => (
              <div key={listing.id} className="relative w-64 max-[430px]:w-60 max-[393px]:w-52 max-[375px]:w-44 flex-shrink-0 overflow-hidden rounded-3xl max-[375px]:rounded-2xl bg-card p-2.5 max-[430px]:p-2 max-[375px]:p-1.5 card-shadow snap-center">
                {/* Edit button */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/listing/${listing.id}/edit`);
                  }} 
                  className="absolute right-4 max-[430px]:right-3 max-[375px]:right-2.5 top-4 max-[430px]:top-3 max-[375px]:top-2.5 z-10 flex h-8 w-8 max-[430px]:h-7 max-[430px]:w-7 max-[375px]:h-6 max-[375px]:w-6 items-center justify-center rounded-lg max-[375px]:rounded-md bg-card/80 backdrop-blur-sm"
                >
                  <Pencil className="h-4 w-4 max-[430px]:h-3.5 max-[430px]:w-3.5 max-[375px]:h-3 max-[375px]:w-3 text-foreground" />
                </button>
                
                {/* Image */}
                <div 
                  className="aspect-[3/4] max-[430px]:aspect-[3/4] max-[393px]:aspect-[4/5] max-[375px]:aspect-[1/1] w-full overflow-hidden rounded-2xl max-[375px]:rounded-xl cursor-pointer"
                  onClick={() => navigate(`/listing/${listing.id}`)}
                >
                  <img src={listing.images[0]} alt={listing.title} className="h-full w-full object-cover" />
                </div>
                
                {/* Content */}
                <div className="px-2 max-[393px]:px-1.5 max-[375px]:px-1 pt-3 max-[393px]:pt-1.5 max-[375px]:pt-1.5 pb-2.5 max-[393px]:pb-2 max-[375px]:pb-1.5">
                  <div className="flex items-end justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base max-[393px]:text-sm max-[375px]:text-xs font-semibold text-foreground truncate">{listing.title}</h3>
                      <div className="mt-1.5 max-[393px]:mt-0.5 max-[375px]:mt-0.5 flex flex-nowrap gap-1.5 max-[393px]:gap-1 max-[375px]:gap-1">
                        <span className="rounded-full bg-muted px-2.5 max-[393px]:px-1.5 max-[375px]:px-1.5 py-0.5 text-xs max-[393px]:text-[10px] max-[375px]:text-[9px] font-medium text-muted-foreground whitespace-nowrap">
                          {formatTagLabel(listing.size, true)}
                        </span>
                        <span className="rounded-full bg-muted px-2.5 max-[393px]:px-1.5 max-[375px]:px-1.5 py-0.5 text-xs max-[393px]:text-[10px] max-[375px]:text-[9px] font-medium text-muted-foreground truncate">
                          {listing.brand}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2 max-[393px]:ml-1 max-[375px]:ml-1">
                      <p className="text-lg max-[393px]:text-base max-[375px]:text-sm font-bold text-foreground leading-none">${listing.price}</p>
                      <p className="text-xs max-[393px]:text-[10px] max-[375px]:text-[9px] text-muted-foreground whitespace-nowrap leading-tight -mt-0.5">+ ${listing.shipping_price || 0} shipping</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-4 py-12">
            <p className="text-muted-foreground">{activeTab === 'listings' ? 'No listings yet' : 'No sold items yet'}</p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Profile;
