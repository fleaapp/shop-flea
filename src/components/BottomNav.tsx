import { useMemo, useCallback, useTransition } from 'react';
import { getDefaultAvatar } from '@/utils/defaultAvatars';
import { getAvatarUrl } from '@/utils/optimizedImage';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useNavBadges } from '@/hooks/useNavBadges';
import { useOrders } from '@/hooks/useOrders';
import { useUnreadOrderMessages } from '@/hooks/useUnreadOrderMessages';
import { useNotifications } from '@/hooks/useNotifications';
import { useAdminRole } from '@/hooks/useAdminRole';
import { formatAdminBadgeCount, useAdminBadges } from '@/hooks/admin/useAdminBadges';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  path: string;
  badge?: number;
}

interface BottomNavProps {
  adminSettingsBadge?: number;
}

const BottomNav = ({ adminSettingsBadge }: BottomNavProps = {}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [, startTransition] = useTransition();
  const { user, profile } = useAuth();

  const navBadges = useNavBadges();
  const { buyerOrderGroups, sellerOrderGroups } = useOrders();
  const { perOrder } = useUnreadOrderMessages();
  const { badgeCount: notificationBadgeCount } = useNotifications();
  const { isAdmin, loading: adminRoleLoading } = useAdminRole();
  const { total: fetchedAdminTotal } = useAdminBadges({ enabled: isAdmin && adminSettingsBadge === undefined });
  const adminTotal = adminSettingsBadge ?? fetchedAdminTotal;

  // Cart badge — mirrors src/pages/Cart.tsx ordersBadgeCount
  const ordersBadge = useMemo(() => {
    const active = buyerOrderGroups.filter(
      (g) => g.status === 'awaiting' || g.status === 'shipped',
    );
    const unread = active.reduce(
      (s, g) => s + g.orders.reduce((n, o) => n + (perOrder.get(o.id) || 0), 0),
      0,
    );
    const count = active.length + unread;
    return count || undefined;
  }, [buyerOrderGroups, perOrder]);

  // Profile badge — mirrors src/pages/Profile.tsx salesBadge
  const salesBadge = useMemo(() => {
    const toShip = sellerOrderGroups.filter((g) => g.status === 'awaiting').length;
    const unread = sellerOrderGroups.reduce(
      (s, g) => s + g.orders.reduce((n, o) => n + (perOrder.get(o.id) || 0), 0),
      0,
    );
    const count = toShip + unread;
    return count || undefined;
  }, [sellerOrderGroups, perOrder]);

  // Alerts badge — mirrors src/pages/Notifications.tsx (since-dismissed)
  const alertsBadge = notificationBadgeCount || undefined;

  // Settings badge — admins get the full Admin Dashboard total.
  // Non-admins get support-thread unread only.
  const settingsBadge = useMemo(() => {
    if (isAdmin) return adminTotal || undefined;
    if (adminRoleLoading) return undefined;
    return navBadges.unread_support || undefined;
  }, [isAdmin, adminRoleLoading, adminTotal, navBadges.unread_support]);

  const handleNavigate = useCallback((path: string) => {
    startTransition(() => {
      navigate(path);
    });
  }, [navigate, startTransition]);

  const profileIcon = (
    <div className="h-5 w-5 rounded-full overflow-hidden bg-background flex items-center justify-center">
      <img
        src={getAvatarUrl(profile?.avatar_url) || getDefaultAvatar(user?.id || 'guest')}
        alt="Profile"
        className="h-full w-full object-cover"
      />
    </div>
  );

  const navItems: NavItem[] = useMemo(() => [
    { icon: <span className="text-lg">⚙️</span>, label: 'Settings', path: '/settings', badge: settingsBadge },
    { icon: profileIcon, label: 'Profile', path: '/profile', badge: salesBadge },
    { icon: <span className="text-lg">🏠</span>, label: 'Home', path: '/' },
    { icon: <span className="text-lg">🛒</span>, label: 'Cart', path: '/cart', badge: ordersBadge },
    { icon: <span className="text-lg">🔔</span>, label: 'Alerts', path: '/notifications', badge: alertsBadge },
  ], [profile?.avatar_url, profileIcon, ordersBadge, alertsBadge, salesBadge, settingsBadge]);

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
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 flex justify-center pb-3 max-[375px]:pb-2 pt-3 max-[375px]:pt-2 z-50 pointer-events-none"
        data-onboarding="bottom-nav"
      >
        <div className="mx-4 max-[375px]:mx-2 flex items-center gap-2 max-[375px]:gap-1 rounded-full bg-nav px-4 max-[375px]:px-3 py-3 max-[375px]:py-2.5 nav-shadow pointer-events-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const onboardingId = getOnboardingId(item.path);

            return (
              <button
                key={item.path}
                onClick={() => handleNavigate(item.path)}
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
                  <span className="absolute right-0 top-0 flex h-5 min-w-5 translate-x-1/3 -translate-y-1/3 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                    {formatAdminBadgeCount(item.badge)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default BottomNav;
