import { Plus, Star, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import BottomNav from '@/components/BottomNav';
import { useAuth } from '@/context/AuthContext';
import { useUserListings } from '@/hooks/useListings';

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
    <div className="min-h-screen bg-background pb-24">
      <div className="flex flex-col items-center px-4 pt-6">
        <div className="relative">
          <div className="h-20 w-20 rounded-full bg-muted p-1" style={{
            background: 'linear-gradient(135deg, hsl(var(--muted)) 0%, hsl(var(--border)) 100%)',
            clipPath: 'polygon(50% 0%, 61% 3%, 70% 7%, 78% 13%, 85% 20%, 90% 28%, 93% 37%, 95% 47%, 95% 57%, 93% 67%, 88% 76%, 82% 84%, 74% 90%, 65% 95%, 55% 98%, 45% 98%, 35% 95%, 26% 90%, 18% 84%, 12% 76%, 7% 67%, 5% 57%, 5% 47%, 7% 37%, 10% 28%, 15% 20%, 22% 13%, 30% 7%, 39% 3%, 50% 0%)'
          }}>
            <img src={profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`} alt="Profile" className="h-full w-full rounded-full bg-card object-cover" />
          </div>
        </div>
        <h2 className="mt-3 text-lg font-semibold text-foreground">{profile?.username || '@user'}</h2>
        <div className="mt-2 flex items-center gap-1 rounded-full bg-card px-3 py-1 card-shadow">
          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          <span className="text-sm font-medium text-foreground">{profile?.rating || 0}/5</span>
        </div>
      </div>

      <div className="mt-6 flex justify-center items-center gap-3">
        <button 
          onClick={() => navigate('/create')} 
          className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground"
        >
          <Plus className="h-5 w-5 text-card" />
        </button>
        <div className="flex rounded-full bg-card p-1 card-shadow">
          <button onClick={() => setActiveTab('listings')} className={`rounded-full px-6 py-2 text-sm font-medium transition-all ${activeTab === 'listings' ? 'bg-charcoal text-white' : 'text-muted-foreground hover:text-foreground'}`}>
            Listings
          </button>
          <button onClick={() => setActiveTab('sold')} className={`rounded-full px-6 py-2 text-sm font-medium transition-all ${activeTab === 'sold' ? 'bg-charcoal text-white' : 'text-muted-foreground hover:text-foreground'}`}>
            Sold
          </button>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto px-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : displayListings.length > 0 ? (
          <div className="flex gap-4 pb-4" style={{ width: 'max-content' }}>
            {displayListings.map((listing) => (
              <div key={listing.id} className="relative w-64 flex-shrink-0 overflow-hidden rounded-3xl bg-card p-2.5 card-shadow">
                {/* Edit button */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/listing/${listing.id}/edit`);
                  }} 
                  className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-card/80 backdrop-blur-sm"
                >
                  <Pencil className="h-4 w-4 text-foreground" />
                </button>
                
                {/* Image */}
                <div 
                  className="aspect-[3/4] w-full overflow-hidden rounded-2xl cursor-pointer"
                  onClick={() => navigate(`/listing/${listing.id}`)}
                >
                  <img src={listing.images[0]} alt={listing.title} className="h-full w-full object-cover" />
                </div>
                
                {/* Content */}
                <div className="px-2 pt-3 pb-1">
                  <div className="flex items-end justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-foreground truncate">{listing.title}</h3>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                          {listing.size}
                        </span>
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                          {listing.brand}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className="text-lg font-bold text-foreground">${listing.price}</p>
                      <p className="text-xs text-muted-foreground">+ ${listing.shipping_price || 0} shipping</p>
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
