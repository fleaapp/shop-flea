import { ArrowLeft, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import BottomNav from '@/components/BottomNav';
import { mockListings } from '@/data/mockListings';
import { toast } from 'sonner';

const Favorites = () => {
  const navigate = useNavigate();
  
  // Using first 2 mock listings as saved items for demo
  const savedItems = mockListings.slice(0, 2);

  const handleRemove = (id: string) => {
    toast('Removed from favorites');
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="flex items-center gap-4 px-4 py-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="h-10 w-10 rounded-full"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold text-foreground">Saved Items</h1>
      </header>
      
      {/* List */}
      <div className="px-4 space-y-4">
        {savedItems.length > 0 ? (
          savedItems.map((item) => (
            <div
              key={item.id}
              className="flex gap-4 rounded-2xl bg-card p-4 card-shadow cursor-pointer"
              onClick={() => navigate(`/listing/${item.id}`, { state: { listing: item } })}
            >
              <img
                src={item.image}
                alt={item.title}
                className="h-24 w-24 rounded-xl object-cover"
              />
              
              <div className="flex flex-1 flex-col justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.location}</p>
                </div>
                
                <div className="flex items-center justify-between">
                  <p className="text-lg font-bold text-foreground">${item.price}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(item.id);
                    }}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-lg font-medium text-muted-foreground">No saved items yet</p>
            <p className="mt-2 text-sm text-muted-foreground">Swipe right on items you like</p>
            <Button
              onClick={() => navigate('/')}
              className="mt-6 rounded-full bg-primary text-primary-foreground"
            >
              Browse Listings
            </Button>
          </div>
        )}
      </div>
      
      <BottomNav />
    </div>
  );
};

export default Favorites;
