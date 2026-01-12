import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  path: string;
  badge?: number;
}

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { cartItems } = useCart();
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('user_id', user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const ProfileIcon = () => (
    <div className="h-5 w-5 rounded-full overflow-hidden bg-muted flex items-center justify-center">
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt="Profile" className="h-full w-full object-cover" />
      ) : (
        <span className="text-sm">👤</span>
      )}
    </div>
  );

  const navItems: NavItem[] = [
    { icon: <span className="text-lg">⚙️</span>, label: 'Settings', path: '/settings' },
    { icon: <ProfileIcon />, label: 'Profile', path: '/profile' },
    { icon: <span className="text-lg">🏠</span>, label: 'Home', path: '/' },
    { icon: <span className="text-lg">🛒</span>, label: 'Cart', path: '/cart', badge: cartItems.length || undefined },
    { icon: <span className="text-lg">🔔</span>, label: 'Alerts', path: '/notifications' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 flex justify-center py-3 z-50 pointer-events-none">
      <div className="mx-4 flex items-center gap-2 rounded-full bg-nav px-4 py-3 nav-shadow pointer-events-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'relative flex items-center gap-2 rounded-full px-4 py-2 transition-all duration-300',
                isActive 
                  ? 'bg-primary text-primary-foreground font-medium' 
                  : 'text-muted-foreground hover:text-card'
              )}
            >
              {item.icon}
              {isActive && (
                <span className="text-sm">{item.label}</span>
              )}
              {item.badge && !isActive && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
