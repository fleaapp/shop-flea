import { ArrowLeft, Bell, Package, MessageCircle, Heart, Tag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import BottomNav from '@/components/BottomNav';

interface Notification {
  id: string;
  type: 'message' | 'like' | 'sold' | 'price-drop';
  title: string;
  description: string;
  time: string;
  read: boolean;
}

const notifications: Notification[] = [
  {
    id: '1',
    type: 'message',
    title: 'New message',
    description: 'Sarah M. sent you a message about Denim Jacket',
    time: '2h ago',
    read: false,
  },
  {
    id: '2',
    type: 'like',
    title: 'Someone saved your item',
    description: 'Your White Sneakers was saved by 3 people',
    time: '5h ago',
    read: false,
  },
  {
    id: '3',
    type: 'price-drop',
    title: 'Price drop alert',
    description: 'Red Leather Bag price dropped to $40',
    time: '1d ago',
    read: true,
  },
  {
    id: '4',
    type: 'sold',
    title: 'Item sold!',
    description: 'Congratulations! Your Vintage Dress was sold',
    time: '2d ago',
    read: true,
  },
];

const getIcon = (type: Notification['type']) => {
  switch (type) {
    case 'message':
      return <MessageCircle className="h-5 w-5" />;
    case 'like':
      return <Heart className="h-5 w-5" />;
    case 'sold':
      return <Package className="h-5 w-5" />;
    case 'price-drop':
      return <Tag className="h-5 w-5" />;
  }
};

const getIconBg = (type: Notification['type']) => {
  switch (type) {
    case 'message':
      return 'bg-blue-100 text-blue-600';
    case 'like':
      return 'bg-pink-100 text-pink-600';
    case 'sold':
      return 'bg-green-100 text-green-600';
    case 'price-drop':
      return 'bg-orange-100 text-orange-600';
  }
};

const Notifications = () => {
  const navigate = useNavigate();

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
        <h1 className="text-xl font-bold text-foreground">Notifications</h1>
      </header>
      
      {/* List */}
      <div className="px-4 space-y-3">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`flex gap-4 rounded-2xl p-4 transition-all cursor-pointer ${
              notification.read ? 'bg-card' : 'bg-card card-shadow'
            }`}
          >
            <div className={`flex h-12 w-12 items-center justify-center rounded-full ${getIconBg(notification.type)}`}>
              {getIcon(notification.type)}
            </div>
            
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <h3 className={`font-medium ${notification.read ? 'text-muted-foreground' : 'text-foreground'}`}>
                  {notification.title}
                </h3>
                <span className="text-xs text-muted-foreground">{notification.time}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{notification.description}</p>
            </div>
            
            {!notification.read && (
              <div className="flex h-2 w-2 rounded-full bg-primary" />
            )}
          </div>
        ))}
      </div>
      
      <BottomNav />
    </div>
  );
};

export default Notifications;
