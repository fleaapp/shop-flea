import React, { useState, useEffect } from 'react';
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
import { useUnreadSupport } from '@/hooks/useUnreadSupport';
import { useAdminRole } from '@/hooks/useAdminRole';
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

  // Notifications toggle state
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted');
    }
  }, []);

  const handleToggleNotifications = async (checked: boolean) => {
    if (!('Notification' in window)) {
      toast.error('Notifications are not supported in this browser');
      return;
    }
    if (checked) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
        // Also trigger the full push subscription save
        triggerSubscribe();
      } else if (permission === 'denied') {
        setNotificationsEnabled(false);
        toast.error('Notifications blocked. Enable them in your browser/device settings.');
      } else {
        setNotificationsEnabled(false);
      }
    } else {
      toast('To disable notifications, use your browser or device settings.');
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
      const {
        error
      } = await supabase.from('profiles').update({
        pause_selling: checked
      } as any).eq('user_id', user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success(checked ? 'Selling paused' : 'Selling resumed');
    } catch (error) {
      toast.error('Failed to update pause selling status');
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
  const helpCentreItems = [{
    icon: <span className="text-base">💬</span>,
    label: 'Contact Support',
    action: () => navigate('/contact-support'),
    badge: supportUnread || undefined
  }, {
    icon: <span className="text-base">❓</span>,
    label: 'FAQ',
    action: () => navigate('/faq')
  }, {
    icon: <span className="text-base">📮</span>,
    label: 'Suggestion Box',
    action: () => navigate('/suggestion-box')
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
    icon: <span className="text-base">📦</span>,
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
      action: () => navigate('/admin')
    });
  }
  if (!isGuest) {
    supportItems.push({
      icon: <span className="text-base">🚪</span>,
      label: 'Logout',
      action: handleLogout,
      isLogout: true
    });
  }

  const settingsGroups = [
    { title: 'Account', items: accountItems },
    { title: 'Support', items: supportItems }
  ];
  return <div className="min-h-screen bg-background pb-24 max-[375px]:pb-20">
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
                        <span className="text-base max-[375px]:text-sm font-bold">Log In</span>
                        <ChevronRight className="h-5 w-5 text-muted-foreground/70" />
                      </div>
                      <div
                        className="flex items-center justify-between rounded-2xl p-4 pl-6 max-[375px]:p-3 max-[375px]:pl-5 card-shadow bg-muted-foreground/20 text-muted-foreground cursor-pointer"
                        onClick={() => navigate('/auth', { state: { initialTab: 'signup' } })}
                      >
                        <span className="text-base max-[375px]:text-sm font-bold">Sign Up</span>
                        <ChevronRight className="h-5 w-5 text-muted-foreground/70" />
                      </div>
                    </div>
                  )}
                  <div className="space-y-2 max-[375px]:space-y-1.5">
                    {group.items.map(item => <div key={item.label}>
                        <div className={`flex items-center justify-between rounded-2xl p-4 pl-6 max-[375px]:p-3 max-[375px]:pl-5 card-shadow ${(item as any).isLogout ? 'bg-[#e0e0dc]' : 'bg-card'} ${item.toggle ? '' : 'cursor-pointer'}`} onClick={async () => {
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
                            {(item as any).badge && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                                {(item as any).badge}
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
                    <div className={`flex items-center justify-between rounded-2xl p-4 pl-6 max-[375px]:p-3 max-[375px]:pl-5 card-shadow ${(item as any).isLogout ? 'bg-[#e0e0dc]' : 'bg-card'} ${item.toggle ? '' : 'cursor-pointer'}`} onClick={async () => {
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
                        {(item as any).badge && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                            {(item as any).badge}
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
                                {(subItem as any).badge && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                                    {(subItem as any).badge}
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
      
      
      <BottomNav />
    </div>;
};
export default Settings;