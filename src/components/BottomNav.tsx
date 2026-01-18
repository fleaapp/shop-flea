import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useCart } from '@/context/CartContext';

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

  const navItems: NavItem[] = useMemo(() => [
    { icon: null, label: 'Settings', path: '/settings' },
    { icon: null, label: 'Profile', path: '/profile' },
    { icon: null, label: 'Home', path: '/' },
    { icon: null, label: 'Cart', path: '/cart', badge: cartItems.length || undefined },
    { icon: null, label: 'Alerts', path: '/notifications' },
  ], [cartItems.length]);

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
                'relative flex items-center justify-center rounded-full px-4 max-[375px]:px-3 py-2 max-[375px]:py-1.5 transition-colors duration-150 text-sm max-[375px]:text-xs',
                isActive 
                  ? 'bg-primary text-primary-foreground font-bold' 
                  : 'text-muted-foreground hover:text-card'
              )}
            >
              {item.label}
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
