import React, { useState } from 'react';
import { getDefaultAvatar } from '@/utils/defaultAvatars';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '@/components/BottomNav';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useDiscardedListings } from '@/hooks/useDiscardedListings';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/supabase';
import FilterPreferencesSheet from '@/components/FilterPreferencesSheet';
import ShippingSettingsSheet from '@/components/ShippingSettingsSheet';
import { useOnboarding } from '@/context/OnboardingContext';
import PaymentMethodsSection from '@/components/PaymentMethodsSection';
import { useUnreadSupport } from '@/hooks/useUnreadSupport';
const Settings = () => {
  const navigate = useNavigate();
  const {
    signOut,
    profile,
    user,
    refreshProfile
  } = useAuth();
  const {
    clearDiscarded
  } = useDiscardedListings();
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [shippingOpen, setShippingOpen] = useState(false);
  const { openCarousel } = useOnboarding();
  const {
    total: supportUnread
  } = useUnreadSupport();

  // Get pause_selling from profile
  const pauseSelling = (profile as any)?.pause_selling || false;
  const handleRefreshDiscarded = async () => {
    const success = await clearDiscarded();
    if (success) {
      toast.success('🔁 Passed listings refreshed! You can browse them again.');
    } else {
      toast.error('Failed to refresh passed listings');
    }
  };
  const handleLogout = async () => {
    await signOut();
    toast.success('Logged out');
    navigate('/auth');
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
    icon: <span className="text-base">🔒</span>,
    label: 'Terms & Privacy'
  }, {
    icon: <span className="text-base">📖</span>,
    label: 'App Walkthrough',
    action: () => openCarousel()
  }];
  const settingsGroups = [{
    title: 'Account',
    items: [{
      icon: <ProfileAvatar />,
      label: 'Edit Profile'
    }, {
      icon: <span className="text-base">🔁</span>,
      label: 'Refresh Passed Listings',
      action: handleRefreshDiscarded
    }, {
      icon: <span className="text-base">📏</span>,
      label: 'Filter Preferences',
      action: () => setPreferencesOpen(true)
    }, {
      icon: <span className="text-base">📦</span>,
      label: 'Shipping Settings',
      action: () => setShippingOpen(true)
    }, {
      icon: <span className="text-base">⏸️</span>,
      label: 'Pause Selling',
      toggle: true,
      checked: pauseSelling,
      onToggle: handleTogglePauseSelling
    }]
  }, {
    title: 'Support',
    items: [{
      icon: <span className="text-base">🛠️</span>,
      label: 'Help Centre',
      expandable: true,
      onExpand: () => setHelpCentreExpanded(!helpCentreExpanded),
      isExpanded: helpCentreExpanded,
      badge: supportUnread || undefined
    }, {
      icon: <span className="text-base">🚪</span>,
      label: 'Logout',
      action: handleLogout,
      isLogout: true
    }]
  }];
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
                <PaymentMethodsSection />
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