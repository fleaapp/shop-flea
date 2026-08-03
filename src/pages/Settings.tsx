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

  // Offers toggle - lets buyers negotiate on this seller's listings.
  const offersEnabled = (profile as any)?.offers_enabled ?? false;
  const handleToggleOffers = async (checked: boolean) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ offers_enabled: checked } as any)
        .eq('user_id', user.id)
        .select('offers_enabled')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('No profile row updated (session mismatch)');
      await refreshProfile();
      toast.success(checked ? 'Offers on' : 'Offers off');
    } catch (error: any) {
      console.error('[offers_enabled] update failed:', error);
      toast.error(`Failed to update: ${error?.message ?? 'unknown error'}`);
    }
  };

  // Marketing opt-out (Spam Act compliance — transactional comms unaffected).
  const marketingOptIn = (profile as any)?.marketing_opt_in ?? true;
  const handleToggleMarketing = async (checked: boolean) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ marketing_opt_in: checked } as any)
        .eq('user_id', user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success(checked ? 'Marketing emails on' : 'Marketing emails off');
    } catch {
      toast.error('Failed to update marketing preferences');
    }
  };
  const ProfileAvatar = () => <Avatar className="h-5 w-5">
      <AvatarImage src={profile?.avatar_url || (user?.id ? getDefaultAvatar(user.id) : '')} alt="Profile" />
      <AvatarFallback className="text-xs">👤</AvatarFallback>
    </Avatar>;
  const [helpCentreExpanded, setHelpCentreExpanded] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const helpCentreItems = [{
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
  const accountItems: any[] = [];
  if (!isGuest) {
    accountItems.push({
      icon: <ProfileAvatar />,
      label: 'Edit Profile'
    });
  }
  accountItems.push({
    icon: <span className="text-base">🔁</span>,
    label: 'Refresh Passed Listings',
    action: handleRefreshDiscarded
  }, {
    icon: <span className="text-base">📏</span>,
    label: 'Filter Preferences',
    action: isGuest ? promptGuest : () => setPreferencesOpen(true)
  }, {
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
  }, isGuest ? {
    icon: <span className="text-base">💰</span>,
    label: 'Offers',
    action: promptGuest
  } : {
    icon: <span className="text-base">💰</span>,
    label: 'Offers',
    toggle: true,
    checked: offersEnabled,
    onToggle: handleToggleOffers
  }, {
    icon: <span className="text-base">🔔</span>,
    label: 'Notifications',
    toggle: true,
    checked: notificationsEnabled,
    onToggle: handleToggleNotifications
  });

  const supportItems: any[] = [{
    icon: <span className="text-base">🛠️</span>,
    label: 'Help Centre',
    expandable: true,
    onExpand: () => setHelpCentreExpanded(!helpCentreExpanded),
    isExpanded: helpCentreExpanded,
    badge: supportUnread || undefined
  }];
  if (!isGuest && isAdmin) {
    supportItems.push({
      icon: <span className="text-base">🛡️</span>,
      label: 'Admin Dashboard',
      action: () => navigate('/admin'),
      badge: adminBadgeTotal || undefined,
    });
  }
  if (!isGuest) {
    supportItems.push({
      icon: <span className="text-base">🚪</span>,
      label: 'Logout',
      action: () => setLogoutConfirmOpen(true),
      isLogout: true
    });
  }

  const settingsGroups = [
    { title: 'Account', items: accountItems },
    { title: 'Support', items: supportItems }
  ];
  return <div className="native-safe-top fixed inset-0 flex flex-col bg-background overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-24 max-[375px]:pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background px-4 max-[375px]:px-3 py-4 max-[375px]:py-3">
        <h1 className="text-xl max-[375px]:text-lg font-bold text-foreground text-center">⚙️ Settings</h1>
      </header>

      
      {/* Settings Groups */}
      <div className="px-4 max-[375px]:px-3 space-y-6 max-[375px]:space-y-4">
        {settingsGroups.map((group, idx) => {
          if (group.title === 'Account') {
            return (
              <React.Fragment key={group.title}>
                <div>
                  <h2 className="mb-3 max-[375px]:mb-2 text-sm max-[375px]:text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {group.title}
                  </h2>
                  {isGuest && (
                    <div className="mb-2 max-[375px]:mb-1.5 space-y-2 max-[375px]:space-y-1.5">
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
                    {group.items.map(item => <div key={item.label}>
                        <div className={`flex items-center justify-between rounded-2xl p-4 pl-6 max-[375px]:p-3 max-[375px]:pl-5 card-shadow ${(item as any).isLogout ? 'bg-surface-muted' : 'bg-card'} ${item.toggle ? '' : 'cursor-pointer'}`} onClick={async () => {
                    if (item.toggle) return;
                    if ((item as any).onExpand) {
                      (item as any).onExpand();
                      return;
                    }
                    if (item.expandable) return;
                    if (item.label === 'Edit Profile') {
                      navigate('/settings/profile');
                    } else if (item.action) {
                      await item.action();
                    } else {
                      toast(`${item.label} clicked`);
                    }
                  }}>
                          <div className="flex items-center gap-3 max-[375px]:gap-2">
                            <div className="text-muted-foreground">{item.icon}</div>
                            <span className="text-base max-[375px]:text-sm font-medium text-foreground">{item.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {(item as any).badge && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                                {formatAdminBadgeCount((item as any).badge)}
                              </span>}
                          {item.toggle ? <Switch checked={item.checked} onCheckedChange={item.onToggle} className="data-[state=checked]:bg-charcoal data-[state=unchecked]:bg-muted [&>span]:data-[state=checked]:bg-lime" /> : item.expandable ? (item as any).isExpanded ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                          </div>
                        </div>
                      </div>)}
                  </div>
                </div>
                {isGuest ? (
                  <div>
                    <h2 className="mb-3 max-[375px]:mb-2 text-sm max-[375px]:text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Payments
                    </h2>
                    <div
                      className="flex items-center justify-between rounded-2xl bg-card p-4 pl-6 max-[375px]:p-3 max-[375px]:pl-5 card-shadow cursor-pointer"
                      onClick={() => promptGuest()}
                    >
                      <div className="flex items-center gap-3 max-[375px]:gap-2">
                        <span className="text-base">💳</span>
                        <span className="text-base max-[375px]:text-sm font-medium text-foreground">Payment Details</span>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                ) : (
                  <PaymentMethodsSection />
                )}
              </React.Fragment>
            );
          }

          return (
            <div key={group.title || idx}>
              {group.title && <h2 className="mb-3 max-[375px]:mb-2 text-sm max-[375px]:text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {group.title}
                </h2>}
              <div className="space-y-2 max-[375px]:space-y-1.5">
                {group.items.map(item => <div key={item.label}>
                    <div className={`flex items-center justify-between rounded-2xl p-4 pl-6 max-[375px]:p-3 max-[375px]:pl-5 card-shadow ${(item as any).isLogout ? 'bg-surface-muted' : 'bg-card'} ${item.toggle ? '' : 'cursor-pointer'}`} onClick={async () => {
                if (item.toggle) return;
                if ((item as any).onExpand) {
                  (item as any).onExpand();
                  return;
                }
                if (item.expandable) return;
                if (item.label === 'Edit Profile') {
                  navigate('/settings/profile');
                } else if (item.action) {
                  await item.action();
                } else {
                  toast(`${item.label} clicked`);
                }
              }}>
                      <div className="flex items-center gap-3 max-[375px]:gap-2">
                        <div className="text-muted-foreground">{item.icon}</div>
                        <span className="text-base max-[375px]:text-sm font-medium text-foreground">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {(item as any).badge && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                            {formatAdminBadgeCount((item as any).badge)}
                          </span>}
                      {item.toggle ? <Switch checked={item.checked} onCheckedChange={item.onToggle} className="data-[state=checked]:bg-charcoal data-[state=unchecked]:bg-muted [&>span]:data-[state=checked]:bg-lime" /> : item.expandable ? (item as any).isExpanded ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                      </div>
                    </div>
                    
                    {/* Help Centre sub-items */}
                    {(item as any).isExpanded && <div className="ml-6 mt-2 space-y-2">
                        {helpCentreItems.map(subItem => <div key={subItem.label}>
                            <div className="flex items-center justify-between rounded-2xl bg-card p-4 pl-6 max-[375px]:p-3 max-[375px]:pl-5 card-shadow cursor-pointer" onClick={async () => {
                    if (subItem.action) {
                      await subItem.action();
                    } else {
                      toast(`${subItem.label} clicked`);
                    }
                  }}>
                              <div className="flex items-center gap-3 max-[375px]:gap-2">
                                <div className="text-muted-foreground">{subItem.icon}</div>
                                <span className="text-base max-[375px]:text-sm font-medium text-foreground">{subItem.label}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {(subItem as any).badge && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                                    {formatAdminBadgeCount((subItem as any).badge)}
                                  </span>}
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                              </div>
                            </div>
                          </div>)}
                      </div>}
                  </div>)}
              </div>
            </div>
          );
        })}
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