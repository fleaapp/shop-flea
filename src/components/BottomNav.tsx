import { useMemo } from 'react';
import { getDefaultAvatar } from '@/utils/defaultAvatars';
import { getAvatarUrl } from '@/utils/optimizedImage';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { useOrders } from '@/hooks/useOrders';
import { useUnreadSupport } from '@/hooks/useUnreadSupport';
import { useUnreadOrderMessages } from '@/hooks/useUnreadOrderMessages';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  path: string;
  badge?: number;
}

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { badgeCount: activityBadgeCount } = useNotifications();
  const { buyerOrders, sellerOrderGroups } = useOrders();
  const { total: supportUnread } = useUnreadSupport();
  const { total: orderMessagesUnread, perOrder } = useUnreadOrderMessages();

  // Orders badge: awaiting + shipped orders (buyer perspective)
  const ordersBadge = useMemo(() => {
    const count = buyerOrders.filter(o => o.status === 'awaiting' || o.status === 'shipped').length + orderMessagesUnread;
    return count || undefined;
  }, [buyerOrders, orderMessagesUnread]);

  // Alerts badge: activity only (sales moved to separate page)
  const alertsBadge = useMemo(() => {
    const count = activityBadgeCount;
    return count || undefined;
  }, [activityBadgeCount]);

  // Sales badge for Profile nav: awaiting seller orders + unread buyer messages on seller orders
  const salesBadge = useMemo(() => {
    const toShipCount = sellerOrderGroups.filter(g => g.status === 'awaiting').length;
    // Count unread messages on seller's orders
    const sellerUnread = sellerOrderGroups.reduce((sum, g) => {
      return sum + g.orders.reduce((s, o) => s + (perOrder.get(o.id) || 0), 0);
    }, 0);
    const count = toShipCount + sellerUnread;
    return count || undefined;
  }, [sellerOrderGroups, perOrder]);

  const profileIcon = (
    <div className="h-5 w-5 rounded-full overflow-hidden bg-background flex items-center justify-center">
      <img
        src={getAvatarUrl(profile?.avatar_url) || (user?.id ? getDefaultAvatar(user.id) : '')}
        alt="Profile"
        className="h-full w-full object-cover"
      />
    </div>
  );

  const navItems: NavItem[] = useMemo(() => [
    { icon: <span className="text-lg">⚙️</span>, label: 'Settings', path: '/settings', badge: supportUnread || undefined },
    { icon: profileIcon, label: 'Profile', path: '/profile', badge: salesBadge },
    { icon: <span className="text-lg">🏠</span>, label: 'Home', path: '/' },
    { icon: <span className="text-lg">🛒</span>, label: 'Cart', path: '/cart', badge: ordersBadge },
    { icon: <span className="text-lg">🔔</span>, label: 'Alerts', path: '/notifications', badge: alertsBadge },
  ], [profile?.avatar_url, profileIcon, ordersBadge, alertsBadge, salesBadge]);

  // Map paths to onboarding IDs
  const getOnboardingId = (path: string) => {
    switch (path) {
      case '/settings': return 'nav-settings';
      case '/profile': return 'nav-profile';
      case '/': return 'nav-home';
      case '/cart': return 'nav-cart';
      case '/notifications': return 'nav-alerts';
      default: return undefined;
    }
  };

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 flex justify-center py-3 max-[375px]:py-2 z-50 pointer-events-none"
      data-onboarding="bottom-nav"
    >
      <div className="mx-4 max-[375px]:mx-2 flex items-center gap-2 max-[375px]:gap-1 rounded-full bg-nav px-4 max-[375px]:px-3 py-3 max-[375px]:py-2.5 nav-shadow pointer-events-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const onboardingId = getOnboardingId(item.path);
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              data-onboarding={onboardingId}
              className={cn(
                'relative flex items-center justify-center rounded-full px-4 max-[375px]:px-3 py-2 max-[375px]:py-1.5 transition-colors duration-150',
                isActive 
                  ? 'bg-primary text-primary-foreground font-bold text-sm max-[375px]:text-xs' 
                  : 'text-muted-foreground hover:text-card'
              )}
            >
              {isActive ? item.label : item.icon}
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
