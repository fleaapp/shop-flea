import { Settings, User, Home, ShoppingCart, Bell } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  path: string;
  badge?: number;
}

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems: NavItem[] = [
    { icon: <Settings className="h-5 w-5" />, label: 'Settings', path: '/settings' },
    { icon: <User className="h-5 w-5" />, label: 'Profile', path: '/profile' },
    { icon: <Home className="h-5 w-5" />, label: 'Home', path: '/' },
    { icon: <ShoppingCart className="h-5 w-5" />, label: 'Cart', path: '/favorites', badge: 1 },
    { icon: <Bell className="h-5 w-5" />, label: 'Alerts', path: '/notifications' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-safe">
      <div className="mx-4 mb-4 flex items-center gap-2 rounded-full bg-nav px-4 py-3 nav-shadow">
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
