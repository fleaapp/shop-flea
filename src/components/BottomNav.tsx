import { useMemo } from 'react';
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

  // Avoid refetching this on every route change; avatar rarely changes.
  const { data: profile } = useQuery({
    queryKey: ['profile-avatar', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 0,
  });

  const profileIcon = (
    <div className="h-5 w-5 rounded-full overflow-hidden bg-muted flex items-center justify-center">
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt="Profile" className="h-full w-full object-cover" />
      ) : (
        <span className="text-sm">👤</span>
      )}
    </div>
  );

  const navItems: NavItem[] = useMemo(() => [
    { icon: <span className="text-lg">⚙️</span>, label: 'Settings', path: '/settings' },
    { icon: profileIcon, label: 'Profile', path: '/profile' },
    { icon: <span className="text-lg">🏠</span>, label: 'Home', path: '/' },
    { icon: <span className="text-lg">🛒</span>, label: 'Cart', path: '/cart', badge: cartItems.length || undefined },
    { icon: <span className="text-lg">🔔</span>, label: 'Alerts', path: '/notifications' },
  ], [cartItems.length, profile?.avatar_url, profileIcon]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 flex justify-center py-3 max-[375px]:py-2 z-50 pointer-events-none">
      <div className="mx-4 max-[375px]:mx-2 flex items-center gap-2 max-[375px]:gap-1 rounded-full bg-nav px-4 max-[375px]:px-3 py-3 max-[375px]:py-2.5 nav-shadow pointer-events-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'relative flex items-center gap-2 max-[375px]:gap-1.5 rounded-full px-4 max-[375px]:px-3 py-2 max-[375px]:py-1.5 transition-colors duration-150',
                isActive 
                  ? 'bg-primary text-primary-foreground font-medium' 
                  : 'text-muted-foreground hover:text-card'
              )}
            >
              {item.icon}
              {isActive && (
                <span className="text-sm max-[375px]:text-xs">{item.label}</span>
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
