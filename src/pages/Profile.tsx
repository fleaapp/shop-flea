import { Plus, Star, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import BottomNav from '@/components/BottomNav';
import { mockListings } from '@/data/mockListings';

const Profile = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'listings' | 'sold'>('listings');

  // Mock user data
  const user = {
    username: '@username',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=User',
    rating: 4.5,
  };

  // Mock listings data - in real app, filter by user
  const userListings = mockListings.slice(0, 3);
  const soldListings = mockListings.slice(1, 2);

  const displayListings = activeTab === 'listings' ? userListings : soldListings;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header with Plus icon */}
      <header className="flex items-center px-4 py-4">
        <button
          onClick={() => navigate('/create')}
          className="flex h-10 w-10 items-center justify-center"
        >
          <Plus className="h-6 w-6 text-foreground" />
        </button>
      </header>

      {/* Profile Info */}
      <div className="flex flex-col items-center px-4 pt-2">
        {/* Avatar with decorative border */}
        <div className="relative">
          <div className="h-20 w-20 rounded-full bg-muted p-1" style={{
            background: 'linear-gradient(135deg, hsl(var(--muted)) 0%, hsl(var(--border)) 100%)',
            clipPath: 'polygon(50% 0%, 61% 3%, 70% 7%, 78% 13%, 85% 20%, 90% 28%, 93% 37%, 95% 47%, 95% 57%, 93% 67%, 88% 76%, 82% 84%, 74% 90%, 65% 95%, 55% 98%, 45% 98%, 35% 95%, 26% 90%, 18% 84%, 12% 76%, 7% 67%, 5% 57%, 5% 47%, 7% 37%, 10% 28%, 15% 20%, 22% 13%, 30% 7%, 39% 3%, 50% 0%)'
          }}>
            <img
              src={user.avatar}
              alt="Profile"
              className="h-full w-full rounded-full bg-card object-cover"
            />
          </div>
        </div>

        {/* Username */}
        <h2 className="mt-3 text-lg font-semibold text-foreground">{user.username}</h2>

        {/* Rating Badge */}
        <div className="mt-2 flex items-center gap-1 rounded-full bg-card px-3 py-1 card-shadow">
          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          <span className="text-sm font-medium text-foreground">{user.rating}/5</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex justify-center">
        <div className="flex rounded-full bg-card p-1 card-shadow">
          <button
            onClick={() => setActiveTab('listings')}
            className={`rounded-full px-6 py-2 text-sm font-medium transition-all ${
              activeTab === 'listings'
                ? 'bg-charcoal text-white'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Listings
          </button>
          <button
            onClick={() => setActiveTab('sold')}
            className={`rounded-full px-6 py-2 text-sm font-medium transition-all ${
              activeTab === 'sold'
                ? 'bg-charcoal text-white'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Sold
          </button>
        </div>
      </div>

      {/* Listings Carousel */}
      <div className="mt-6 overflow-x-auto px-4">
        <div className="flex gap-4 pb-4" style={{ width: 'max-content' }}>
          {displayListings.map((listing) => (
            <div
              key={listing.id}
              className="relative w-64 flex-shrink-0 overflow-hidden rounded-2xl bg-card card-shadow"
            >
              {/* Edit Icon */}
              <button
                onClick={() => navigate(`/listing/${listing.id}`)}
                className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-card/80 backdrop-blur-sm"
              >
                <ExternalLink className="h-4 w-4 text-foreground" />
              </button>

              {/* Listing Image */}
              <div className="aspect-[3/4] w-full">
                <img
                  src={listing.image}
                  alt={listing.title}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Empty state for sold tab */}
      {activeTab === 'sold' && soldListings.length === 0 && (
        <div className="flex flex-col items-center justify-center px-4 py-12">
          <p className="text-muted-foreground">No sold items yet</p>
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default Profile;
