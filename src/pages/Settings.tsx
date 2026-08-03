import React, { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { getDefaultAvatar } from '@/utils/defaultAvatars';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '@/components/BottomNav';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useGuestMode } from '@/context/GuestModeContext';
import { useDiscardedListings } from '@/hooks/useDiscardedListings';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/supabase';
import FilterPreferencesSheet from '@/components/FilterPreferencesSheet';
import ShippingSettingsSheet from '@/components/ShippingSettingsSheet';
import { useOnboarding } from '@/context/OnboardingContext';
import PaymentMethodsSection from '@/components/PaymentMethodsSection';
import { requestNativePushRegistration } from '@/hooks/useNativePushNotifications';

import { useUnreadSupport } from '@/hooks/useUnreadSupport';
import { useAdminRole } from '@/hooks/useAdminRole';
import { formatAdminBadgeCount, useAdminBadges } from '@/hooks/admin/useAdminBadges';

type SettingsItem = {
  icon: React.ReactNode;
  label: string;
  action?: () => void | Promise<void>;
  toggle?: boolean;
  checked?: boolean;
  disabled?: boolean;
  onToggle?: (checked: boolean) => void | Promise<void>;
  badge?: number;
  expandable?: boolean;
  onExpand?: () => void;
  isExpanded?: boolean;
  isLogout?: boolean;
  children?: SettingsItem[];
};

const Settings = () => {
  const navigate = useNavigate();
  const {
    signOut,
    profile,
    user,
    refreshProfile
  } = useAuth();
  const { promptGuest } = useGuestMode();
  const isGuest = !user;
  const {
    clearDiscarded
  } = useDiscardedListings();
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [shippingOpen, setShippingOpen] = useState(false);
  const { openCarousel } = useOnboarding();
  const {
    total: supportUnread
  } = useUnreadSupport();
  const { triggerSubscribe } = usePushNotifications();
  const { isAdmin } = useAdminRole();
  const { total: adminBadgeTotal } = useAdminBadges({ enabled: !isGuest && isAdmin });

  // Notifications toggle state (native + web aware)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      const { getPushPermissionAsync } = await import('@/lib/pushPrompt');
      const perm = await getPushPermissionAsync();
      if (perm === 'granted') {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform() && user?.id) {
          const { invokeCloudFunction } = await import('@/utils/cloudFunctions');
          const { data } = await invokeCloudFunction('push-status', { method: 'GET' });
          const hasToken = Boolean((data as { has_ios_token?: boolean } | null)?.has_ios_token);
          if (!hasToken) requestNativePushRegistration('settings-status-missing-token');
          if (!cancelled) setNotificationsEnabled(hasToken);
          return;
        }
      }
      if (!cancelled) setNotificationsEnabled(perm === 'granted');
    };
    sync();

    let remove: (() => void) | undefined;
    (async () => {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { App: CapacitorApp } = await import('@capacitor/app');
        const handle = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
          if (isActive) sync();
        });
        remove = () => { handle.then((h) => h.remove()); };
      }
    })();
    return () => { cancelled = true; remove?.(); };
  }, [user?.id]);

  const handleToggleNotifications = async (checked: boolean) => {
    const { Capacitor } = await import('@capacitor/core');
    const isNative = Capacitor.isNativePlatform();

    if (!checked) {
      if (isNative) {
        toast('To disable notifications, open iOS Settings → Flea → Notifications.');
      } else {
        toast('To disable notifications, use your browser or device settings.');
      }
      return;
    }

    if (isNative) {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const check = await PushNotifications.checkPermissions();
        let receive = check.receive;
        if (receive !== 'granted' && receive !== 'denied') {
          const req = await PushNotifications.requestPermissions();
          receive = req.receive;
        }
        if (receive === 'granted') {
          requestNativePushRegistration('settings-toggle');
          setNotificationsEnabled(false);
          toast.success("Notifications are on. We're finishing device setup now.");
        } else {
          setNotificationsEnabled(false);
          toast.error('Notifications blocked. Enable them in iOS Settings → Flea.');
        }
      } catch (err) {
        console.error('[Settings] native push enable failed:', err);
        toast.error('Could not enable notifications. Please try again.');
      }
      return;
    }

    if (typeof Notification === 'undefined') {
      toast.error('Notifications are not supported in this browser');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setNotificationsEnabled(true);
      triggerSubscribe();
    } else if (permission === 'denied') {
      setNotificationsEnabled(false);
      toast.error('Notifications blocked. Enable them in your browser/device settings.');
    } else {
      setNotificationsEnabled(false);
    }
  };


  // Get pause_selling from profile
  const pauseSelling = (profile as any)?.pause_selling || false;
  const handleRefreshDiscarded = async () => {
    const success = await clearDiscarded();
    if (success) {
      toast.success('🔁 Passed listings refreshed! You can browse them again.');
    } else {
      toast.error('🔁 Failed to refresh passed listings');
    }
  };
  const handleLogout = async () => {
    navigate('/auth', { replace: true });
    await signOut();
    if ((window.navigator as Navigator & { standalone?: boolean }).standalone) {
      window.location.replace('/auth');
      return;
    }
    toast.success('Logged out');
  };
  const handleTogglePauseSelling = async (checked: boolean) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ pause_selling: checked } as any)
        .eq('user_id', user.id)
        .select('pause_selling')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('No profile row updated (session mismatch)');
      await refreshProfile();
      toast.success(checked ? 'Selling paused' : 'Selling resumed');
    } catch (error: any) {
      console.error('[pause_selling] update failed:', error);
      toast.error(`Failed to update: ${error?.message ?? 'unknown error'}`);
    }
  };

  const ProfileAvatar = () => <Avatar className="h-5 w-5">
      <AvatarImage src={profile?.avatar_url || (user?.id ? getDefaultAvatar(user.id) : '')} alt="Profile" />
      <AvatarFallback className="text-xs">👤</AvatarFallback>
    </Avatar>;
  const [helpCentreExpanded, setHelpCentreExpanded] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const helpCentreItems: SettingsItem[] = [{
    icon: <span className="text-base">💬</span>,
    label: 'Contact Support',
    action: isGuest ? promptGuest : () => navigate('/contact-support'),
    badge: supportUnread || undefined
  }, {
    icon: <span className="text-base">❓</span>,
    label: 'FAQ',
    action: () => navigate('/faq')
  }, {
    icon: <span className="text-base">📮</span>,
    label: 'Suggestion Box',
    action: isGuest ? promptGuest : () => navigate('/suggestion-box')
  }, {
    icon: <span className="text-base">📄</span>,
    label: 'Terms & Conditions',
    action: () => navigate('/terms')
  }, {
    icon: <span className="text-base">🔒</span>,
    label: 'Privacy Policy',
    action: () => navigate('/privacy')
  }, {
    icon: <span className="text-base">📖</span>,
    label: 'App Walkthrough',
    action: () => openCarousel()
  }];

  // ---- General ----
  const generalItems: SettingsItem[] = [];
  if (!isGuest) {
    generalItems.push({
      icon: <ProfileAvatar />,
      label: 'Edit Profile',
      action: () => navigate('/settings/profile')
    });
  }
  generalItems.push({
    icon: <span className="text-base">🔔</span>,
    label: 'Notifications',
    toggle: true,
    checked: notificationsEnabled,
    onToggle: handleToggleNotifications
  });
  if (!isGuest && isAdmin) {
    generalItems.push({
      icon: <span className="text-base">🛡️</span>,
      label: 'Admin Dashboard',
      action: () => navigate('/admin'),
      badge: adminBadgeTotal || undefined
    });
  }

  // ---- Buyer ----
  const buyerItems: SettingsItem[] = [{
    icon: <span className="text-base">🔁</span>,
    label: 'Refresh Passed Listings',
    action: handleRefreshDiscarded
  }, {
    icon: <span className="text-base">📏</span>,
    label: 'Filter Preferences',
    action: isGuest ? promptGuest : () => setPreferencesOpen(true)
  }];

  // ---- Seller (below the Become a Seller / Seller Dashboard row) ----
  const sellerItems: SettingsItem[] = [{
    icon: <span className="text-base">✈️</span>,
    label: 'Shipping Settings',
    action: isGuest ? promptGuest : () => setShippingOpen(true)
  }, isGuest ? {
    icon: <span className="text-base">⏸️</span>,
    label: 'Pause Selling',
    action: promptGuest
  } : {
    icon: <span className="text-base">⏸️</span>,
    label: 'Pause Selling',
    toggle: true,
    checked: pauseSelling,
    onToggle: handleTogglePauseSelling
  }, {
    icon: <span className="text-base">💰</span>,
    label: 'Offers',
    action: isGuest ? promptGuest : () => navigate('/offers')
  }];

  // ---- Support ----
  const supportItems: SettingsItem[] = [{
    icon: <span className="text-base">🛠️</span>,
    label: 'Help Centre',
    expandable: true,
    onExpand: () => setHelpCentreExpanded(!helpCentreExpanded),
    isExpanded: helpCentreExpanded,
    badge: supportUnread || undefined
  }];

  // ---- Logout ----
  const logoutItems: SettingsItem[] = isGuest ? [] : [{
    icon: <span className="text-base">🚪</span>,
    label: 'Logout',
    action: () => setLogoutConfirmOpen(true),
    isLogout: true
  }];

  const handleItemClick = async (item: SettingsItem) => {
    if (item.toggle) return;
    if (item.onExpand) {
      item.onExpand();
      return;
    }
    if (item.expandable) return;
    if (item.action) {
      await item.action();
    } else {
      toast(`${item.label} clicked`);
    }
  };

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h2 className="mb-3 max-[375px]:mb-2 text-sm max-[375px]:text-xs font-medium text-muted-foreground uppercase tracking-wide">
      {children}
    </h2>
  );

  const Row = ({ item }: { item: SettingsItem }) => (
    <div>
      <div
        className={`flex items-center justify-between rounded-2xl p-4 pl-6 max-[375px]:p-3 max-[375px]:pl-5 card-shadow ${item.isLogout ? 'bg-surface-muted' : 'bg-card'} ${item.toggle ? '' : 'cursor-pointer'}`}
        onClick={() => handleItemClick(item)}
      >
        <div className="flex items-center gap-3 max-[375px]:gap-2">
          <div className="text-muted-foreground">{item.icon}</div>
          <span className="text-base max-[375px]:text-sm font-medium text-foreground">{item.label}</span>
        </div>
        <div className="flex items-center gap-2">
          {item.badge ? (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
              {formatAdminBadgeCount(item.badge)}
            </span>
          ) : null}
          {item.toggle ? (
            <Switch
              checked={item.checked}
              onCheckedChange={item.onToggle}
              className="data-[state=checked]:bg-charcoal data-[state=unchecked]:bg-muted [&>span]:data-[state=checked]:bg-lime"
            />
          ) : item.expandable ? (
            item.isExpanded ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Sub-items */}
      {item.isExpanded && item.expandable && (
        <div className="ml-6 mt-2 space-y-2">
          {(item.children ?? []).map(subItem => (
            <div
              key={subItem.label}
              className={`flex items-center justify-between rounded-2xl bg-card p-4 pl-6 max-[375px]:p-3 max-[375px]:pl-5 card-shadow ${subItem.toggle ? '' : 'cursor-pointer'}`}
              onClick={() => handleItemClick(subItem)}
            >
              <div className="flex items-center gap-3 max-[375px]:gap-2">
                <div className="text-muted-foreground">{subItem.icon}</div>
                <span className="text-base max-[375px]:text-sm font-medium text-foreground">{subItem.label}</span>
              </div>
              <div className="flex items-center gap-2">
                {subItem.badge ? (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                    {formatAdminBadgeCount(subItem.badge)}
                  </span>
                ) : null}
                {subItem.toggle ? (
                  <Switch
                    checked={subItem.checked}
                    disabled={subItem.disabled}
                    onCheckedChange={subItem.onToggle}
                    className="data-[state=checked]:bg-charcoal data-[state=unchecked]:bg-muted [&>span]:data-[state=checked]:bg-lime"
                  />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return <div className="native-safe-top fixed inset-0 flex flex-col bg-background overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-24 max-[375px]:pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background px-4 max-[375px]:px-3 py-4 max-[375px]:py-3">
        <h1 className="text-xl max-[375px]:text-lg font-bold text-foreground text-center">⚙️ Settings</h1>
      </header>

      {/* Settings Groups */}
      <div className="px-4 max-[375px]:px-3 space-y-6 max-[375px]:space-y-4">
        {/* General */}
        <div>
          <SectionTitle>General</SectionTitle>
          {isGuest && (
            <div className="mb-2 max-[375px]:mb-1.5">
              <div
                className="flex items-center justify-between rounded-2xl p-4 pl-6 max-[375px]:p-3 max-[375px]:pl-5 card-shadow bg-muted-foreground/20 text-muted-foreground cursor-pointer"
                onClick={() => navigate('/auth', { state: { initialTab: 'login' } })}
              >
                <span className="text-base max-[375px]:text-sm font-bold text-muted-foreground">Log In / Sign Up</span>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          )}
          <div className="space-y-2 max-[375px]:space-y-1.5">
            {generalItems.map(item => <Row key={item.label} item={item} />)}
          </div>
        </div>

        {/* Buyer */}
        <div>
          <SectionTitle>Buyer</SectionTitle>
          <div className="space-y-2 max-[375px]:space-y-1.5">
            {buyerItems.map(item => <Row key={item.label} item={item} />)}
          </div>
        </div>

        {/* Seller */}
        <div>
          <SectionTitle>Seller</SectionTitle>
          <div className="space-y-2 max-[375px]:space-y-1.5">
            {isGuest ? (
              <div
                className="flex items-center justify-between rounded-2xl bg-card p-4 pl-6 max-[375px]:p-3 max-[375px]:pl-5 card-shadow cursor-pointer"
                onClick={() => promptGuest()}
              >
                <div className="flex items-center gap-3 max-[375px]:gap-2">
                  <span className="text-base">💸</span>
                  <span className="text-base max-[375px]:text-sm font-medium text-foreground">Become a Seller</span>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            ) : (
              <PaymentMethodsSection hideHeading />
            )}
            {sellerItems.map(item => <Row key={item.label} item={item} />)}
          </div>
        </div>

        {/* Support */}
        <div>
          <SectionTitle>Support</SectionTitle>
          <div className="space-y-2 max-[375px]:space-y-1.5">
            {supportItems.map(item => <Row key={item.label} item={item} />)}
          </div>
        </div>

        {/* Logout */}
        {logoutItems.length > 0 && (
          <div>
            <SectionTitle>Logout</SectionTitle>
            <div className="space-y-2 max-[375px]:space-y-1.5">
              {logoutItems.map(item => <Row key={item.label} item={item} />)}
            </div>
          </div>
        )}
      </div>

      {/* Version */}
      <div className="mt-4 text-center">
        <p className="text-sm max-[375px]:text-xs text-muted-foreground">Version 1.0.0</p>
      </div>

      {/* Filter Preferences Sheet */}
      <FilterPreferencesSheet open={preferencesOpen} onOpenChange={setPreferencesOpen} />

      {/* Shipping Settings Sheet */}
      <ShippingSettingsSheet open={shippingOpen} onOpenChange={setShippingOpen} />
      </div>

      <AlertDialog open={logoutConfirmOpen} onOpenChange={setLogoutConfirmOpen}>
        <AlertDialogContent className="max-w-[280px] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Log out?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll need to sign in again to buy, sell or message.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel className="flex-1 mt-0 h-9 rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout} className="flex-1 h-9 rounded-lg bg-destructive hover:bg-destructive/90">
              Log out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav adminSettingsBadge={!isGuest && isAdmin ? adminBadgeTotal : undefined} />
    </div>;
};
export default Settings;
