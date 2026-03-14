import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import FilterChip from '@/components/FilterChip';
import SwipeCard from '@/components/SwipeCard';
import FilterSheet, { FilterState } from '@/components/FilterSheet';
import SearchSheet from '@/components/SearchSheet';
import WelcomeSetupDialog from '@/components/WelcomeSetupDialog';
import PasswordSetupDialog from '@/components/PasswordSetupDialog';

import { useListings, DbListing } from '@/hooks/useListings';
import { useFavorites } from '@/hooks/useFavorites';
import { useDiscardedListings } from '@/hooks/useDiscardedListings';
import { useCart } from '@/context/CartContext';
import { useOnboarding } from '@/context/OnboardingContext';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Listing } from '@/types/listing';
import { supabase } from '@/lib/supabase';
import { formatSizeKeyLabel } from '@/utils/sizeKeys';
import { getDefaultAvatar } from '@/utils/defaultAvatars';

// Convert DbListing to Listing format for components that expect it
const toDisplayListing = (dbListing: DbListing): Listing => ({
  id: dbListing.id,
  title: dbListing.title,
  price: dbListing.price,
  shippingPrice: dbListing.shipping_price || 0,
  description: dbListing.description || '',
  image: dbListing.images?.[0] || '',
  images: dbListing.images,
  category: dbListing.category,
  size: dbListing.size,
  brand: dbListing.brand,
  tags: dbListing.tags || [],
  sellerId: dbListing.user_id,
  sellerName: dbListing.profiles?.username || '@user',
  sellerAvatar: dbListing.profiles?.avatar_url || getDefaultAvatar(dbListing.user_id),
  location: dbListing.profiles?.location || 'Unknown',
  createdAt: new Date(dbListing.created_at),
  condition: (dbListing.condition as 'new' | 'like-new' | 'good' | 'fair') || 'good',
});

const Index = () => {
  const navigate = useNavigate();
  const { addToCart, removeFromCart, isInCart } = useCart();
  const { addFavorite, removeFavorite, favoriteIds } = useFavorites();
  const { addDiscarded, removeDiscarded, discardedIds } = useDiscardedListings();
  const { checkAndTriggerOnboarding, openCarousel } = useOnboarding();
  const { user, profile, refreshProfile } = useAuth();

  // Check if user needs to set up their profile (new users get auto-generated usernames)
  const needsProfileSetup = profile?.username?.startsWith('@user_') || false;
  const profileLoaded = profile !== null;
  const [welcomeCompleted, setWelcomeCompleted] = useState(false);
  const [passwordCompleted, setPasswordCompleted] = useState(false);
  
  // Sync passwordCompleted from user-scoped localStorage once user is available
  useEffect(() => {
    if (user) {
      const done = localStorage.getItem(`flea_pw_done_${user.id}`) === '1';
      if (done) setPasswordCompleted(true);
      // Clean up stale OAuth flag if password is already set in profile/meta
      const pwInMeta = user.user_metadata?.password_set === true;
      const pwInProfile = profile?.password_set === true;
      if ((pwInMeta || pwInProfile || done) && localStorage.getItem('flea_oauth_signup') === '1') {
        localStorage.removeItem('flea_oauth_signup');
      }
    }
  }, [user, profile]);
  
  // PRIMARY detection: localStorage flag set BEFORE Google OAuth redirect (survives redirects unlike sessionStorage)
  const oauthSignupFlag = localStorage.getItem('flea_oauth_signup') === '1';
  
  // SECONDARY detection: app_metadata checks (fallback for returning users)
  const hasEmailIdentity = user?.identities?.some((id: any) => id.provider === 'email') ?? false;
  
  // Only treat as OAuth if they actually signed up via Google/Apple AND have no email identity
  const isOAuthUserFromMeta = 
    !hasEmailIdentity && (
      user?.app_metadata?.provider === 'google' ||
      user?.app_metadata?.provider === 'apple' ||
      user?.app_metadata?.providers?.includes('google') ||
      user?.app_metadata?.providers?.includes('apple') ||
      user?.identities?.some((id: any) => id.provider === 'google' || id.provider === 'apple')
    );
  
  // Combined: either the localStorage flag OR metadata detection — but never for email-signup users
  const isOAuthUser = !hasEmailIdentity && (oauthSignupFlag || isOAuthUserFromMeta);
  const isGoogleUser = isOAuthUser;
  
  const passwordSetInMeta = user?.user_metadata?.password_set === true;
  const passwordSetInProfile = profile?.password_set === true;
  const passwordAlreadySet = passwordSetInMeta || passwordSetInProfile;

  // Once we determine the password dialog needs to show, lock it so reactive changes can't dismiss it
  const [passwordDialogLocked, setPasswordDialogLocked] = useState(false);

  // Effect for returning OAuth users who already have a profile (not fresh signups)
  useEffect(() => {
    if (passwordDialogLocked || passwordCompleted || passwordAlreadySet) return;
    if (!isOAuthUser || !profileLoaded) return;
    if (!needsProfileSetup) {
      console.log('[PW_DEBUG] ✅ LOCKING password dialog (returning OAuth user)');
      setPasswordDialogLocked(true);
    }
  }, [profileLoaded, needsProfileSetup, isOAuthUser, passwordAlreadySet, passwordCompleted, passwordDialogLocked]);

  // Welcome dialog shows when profile needs setup
  const showWelcomeDialog = needsProfileSetup && !welcomeCompleted;
  // Password dialog: once locked, stays open until explicitly completed
  const showPasswordDialog = passwordDialogLocked && !passwordCompleted;

  // Check if we should start onboarding (for new users after signup)
  // Delay for OAuth users until password is set so onboarding doesn't appear behind password dialog
  useEffect(() => {
    if (isOAuthUser && !passwordCompleted && !passwordAlreadySet) return;
    checkAndTriggerOnboarding();
  }, [checkAndTriggerOnboarding, isOAuthUser, passwordCompleted, passwordAlreadySet]);

  const [pendingExitId, setPendingExitId] = useState<string | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [searchSheetOpen, setSearchSheetOpen] = useState(false);
  
  // Store the full filter state from FilterSheet
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({
    preferences: false,
    hideSoldItems: false,
    sizes: [],
    categories: [],
    genders: [],
    condition: '',
    colours: [],
    styles: [],
    priceRange: [0, 1000],
  });
  
  // Search query state
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Track the last action for undo functionality
  const [lastAction, setLastAction] = useState<{
    listingId: string;
    type: 'discard' | 'favorite' | 'cart';
  } | null>(null);


  // Build filter object from applied filters for useListings hook
  const listingFilters = useMemo(() => {
    const filterObj: Record<string, any> = {};
    
    if (appliedFilters.sizes.length > 0) {
      filterObj.sizes = appliedFilters.sizes;
    }
    if (appliedFilters.categories.length > 0) {
      filterObj.categories = appliedFilters.categories;
    }
    if (appliedFilters.genders.length > 0) {
      filterObj.genders = appliedFilters.genders;
    }
    if (appliedFilters.condition) {
      filterObj.condition = appliedFilters.condition;
    }
    if (appliedFilters.colours.length > 0) {
      filterObj.colours = appliedFilters.colours;
    }
    if (appliedFilters.styles.length > 0) {
      filterObj.styles = appliedFilters.styles;
    }
    if (appliedFilters.priceRange[0] > 0) {
      filterObj.minPrice = appliedFilters.priceRange[0];
    }
    if (appliedFilters.priceRange[1] < 1000) {
      filterObj.maxPrice = appliedFilters.priceRange[1];
    }
    
    return filterObj;
  }, [appliedFilters]);

  // Add search to filters
  const finalFilters = useMemo(() => {
    if (searchQuery) {
      return { ...listingFilters, search: searchQuery };
    }
    return listingFilters;
  }, [listingFilters, searchQuery]);

  const { listings: dbListings, loading } = useListings(finalFilters);

  // Filter out listings that are discarded, favorited, or in cart.
  // IMPORTANT: while the top card is animating out, keep it in the stack so
  // the two cards behind don't collapse/disappear.
  const availableListings = useMemo(() => {
    return dbListings.filter((listing) => {
      if (pendingExitId && listing.id === pendingExitId) return true;

      return (
        !discardedIds.has(listing.id) &&
        !favoriteIds.has(listing.id) &&
        !isInCart(listing.id)
      );
    });
  }, [dbListings, discardedIds, favoriteIds, isInCart, pendingExitId]);

  const currentListings = availableListings.slice(0, 3);

  const handleSwipeLeft = useCallback(async (listingId: string) => {
    if (pendingExitId) return;

    setPendingExitId(listingId);
    await addDiscarded(listingId);
    setLastAction({ listingId, type: 'discard' });
  }, [addDiscarded, pendingExitId]);

  const handleSwipeRight = useCallback(async (listing: DbListing) => {
    if (pendingExitId) return;

    setPendingExitId(listing.id);
    await addFavorite(listing.id, toDisplayListing(listing));
    setLastAction({ listingId: listing.id, type: 'favorite' });
  }, [addFavorite, pendingExitId]);

  const handleSwipeUp = useCallback(async (listing: DbListing) => {
    if (pendingExitId) return;

    setPendingExitId(listing.id);
    await addToCart(toDisplayListing(listing));
    setLastAction({ listingId: listing.id, type: 'cart' });
  }, [addToCart, pendingExitId]);

  const handleUndo = useCallback(async () => {
    if (!lastAction) return;

    const { listingId, type } = lastAction;
    
    if (type === 'discard') {
      await removeDiscarded(listingId);
    } else if (type === 'favorite') {
      await removeFavorite(listingId);
    } else if (type === 'cart') {
      await removeFromCart(listingId);
    }
    
    setLastAction(null);
    toast.success('Action undone!');
  }, [lastAction, removeDiscarded, removeFavorite, removeFromCart]);

  const handleTopExitComplete = useCallback(() => {
    setPendingExitId(null);
  }, []);

  const handleCardClick = (listing: DbListing) => {
    navigate(`/listing/${listing.id}`);
  };

  // Build display chips from applied filters
  const activeFilterChips = useMemo(() => {
    const chips: { label: string; type: string; value: string; colourSwatch?: string }[] = [];
    
    // Add gender/fit first
    appliedFilters.genders.forEach(g => {
      const fitLabel = g === 'women' ? "Women's" : g === 'men' ? "Men's" : g === 'kids' ? 'Kids' : 'Unisex';
      chips.push({ label: fitLabel, type: 'gender', value: g });
    });
    
    appliedFilters.sizes.forEach(size => {
      chips.push({ label: formatSizeKeyLabel(size), type: 'size', value: size });
    });
    appliedFilters.categories.forEach(cat => {
      chips.push({ label: cat.charAt(0).toUpperCase() + cat.slice(1), type: 'category', value: cat });
    });
    if (appliedFilters.condition) {
      chips.push({ label: appliedFilters.condition.charAt(0).toUpperCase() + appliedFilters.condition.slice(1), type: 'condition', value: appliedFilters.condition });
    }
    appliedFilters.colours.forEach(colour => {
      chips.push({ label: colour.charAt(0).toUpperCase() + colour.slice(1), type: 'colour', value: colour, colourSwatch: colour });
    });
    appliedFilters.styles.forEach(style => {
      chips.push({ label: style.charAt(0).toUpperCase() + style.slice(1), type: 'style', value: style });
    });
    
    return chips;
  }, [appliedFilters]);

  const removeFilter = (type: string, value: string) => {
    setAppliedFilters(prev => {
      if (type === 'gender') {
        return { ...prev, genders: prev.genders.filter(g => g !== value) };
      } else if (type === 'size') {
        return { ...prev, sizes: prev.sizes.filter(s => s !== value) };
      } else if (type === 'category') {
        return { ...prev, categories: prev.categories.filter(c => c !== value) };
      } else if (type === 'condition') {
        return { ...prev, condition: '' };
      } else if (type === 'colour') {
        return { ...prev, colours: prev.colours.filter(c => c !== value) };
      } else if (type === 'style') {
        return { ...prev, styles: prev.styles.filter(s => s !== value) };
      }
      return prev;
    });
  };

  const handleSearchClick = () => {
    setSearchSheetOpen(true);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  const handleFilterClick = () => {
    setFilterSheetOpen(true);
  };

  const handleApplyFilters = (filterState: FilterState) => {
    setAppliedFilters(filterState);
    setPendingExitId(null);
    toast.success('Filters applied!');
  };

  // Convert listings for search sheet (still uses mock format)
  const searchListings = dbListings.map(toDisplayListing);

  return (
    <div className="fixed inset-0 flex flex-col bg-background overflow-hidden">
      <Header onSearchClick={handleSearchClick} onFilterClick={handleFilterClick} onUndoClick={handleUndo} canUndo={!!lastAction} />
      
      {/* Active Filters */}
      {(activeFilterChips.length > 0 || searchQuery) && (
        <div className="flex gap-2 px-6 pb-2 flex-shrink-0 overflow-x-auto scrollbar-hide">
          {searchQuery && (
            <FilterChip 
              label={`"${searchQuery}"`} 
              onRemove={clearSearch} 
            />
          )}
          {activeFilterChips.length === 1 && (
            <FilterChip 
              label={activeFilterChips[0].label} 
              onRemove={() => removeFilter(activeFilterChips[0].type, activeFilterChips[0].value)} 
            />
          )}
          {activeFilterChips.length > 1 && (
            <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm text-secondary-foreground">
              <button
                onClick={() => setFilterSheetOpen(true)}
                className="font-medium"
              >
                ({activeFilterChips.length}) Filters
              </button>
              <button
                onClick={() => setAppliedFilters({
                  preferences: false,
                  hideSoldItems: false,
                  sizes: [],
                  categories: [],
                    genders: [],
                    condition: '',
                    colours: [],
                    styles: [],
                    priceRange: [0, 1000],
                })}
                className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Card Stack - centered with space for fixed nav */}
      <div className="flex-1 flex items-center justify-center pb-24 max-[393px]:pb-20 max-[375px]:pb-16 min-h-0">
        <div 
          className="relative w-full max-w-[min(340px,85vw)] h-[min(68vh,520px)] max-[393px]:h-[min(58vh,440px)] max-[375px]:h-[min(55vh,400px)] px-5 max-[375px]:px-3"
          data-onboarding="swipe-card-stack"
        >
          {loading ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <span className="text-5xl">⏳</span>
            </div>
          ) : currentListings.length > 0 ? (
            <>
              {currentListings.map((dbListing, index) => (
                <SwipeCard
                  key={dbListing.id}
                  listing={toDisplayListing(dbListing)}
                  onSwipeLeft={() => handleSwipeLeft(dbListing.id)}
                  onSwipeRight={() => handleSwipeRight(dbListing)}
                  onSwipeUp={() => handleSwipeUp(dbListing)}
                  onExitComplete={index === 0 ? handleTopExitComplete : undefined}
                  onClick={() => handleCardClick(dbListing)}
                  isTop={index === 0}
                  index={index}
                />
              ))}
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center px-4">
              <span className="text-5xl mb-3">😢</span>
              <p className="text-lg font-medium text-muted-foreground">No more listings!</p>
              <p className="mt-2 text-sm text-muted-foreground">Check back later for new items</p>
            </div>
          )}
        </div>
      </div>
      
      <FilterSheet 
        open={filterSheetOpen} 
        onOpenChange={setFilterSheetOpen}
        onApplyFilters={handleApplyFilters}
        preferredSizes={profile?.preferred_sizes}
      />
      <SearchSheet
        open={searchSheetOpen}
        onOpenChange={setSearchSheetOpen}
        onSearch={handleSearch}
        listings={searchListings}
      />
      <WelcomeSetupDialog
        open={showWelcomeDialog}
        isGoogleUser={isGoogleUser}
        onComplete={() => {
          setWelcomeCompleted(true);
          // Use the localStorage flag — it was set BEFORE the OAuth redirect and survives cross-origin redirects
          const isOAuth = localStorage.getItem('flea_oauth_signup') === '1';
          console.log('[PW_DEBUG] onComplete fired:', { isOAuth, passwordCompleted, passwordAlreadySet, oauthSignupFlag });
          if (isOAuth && !passwordCompleted && !passwordAlreadySet) {
            setPasswordDialogLocked(true);
          } else {
            openCarousel();
          }
          refreshProfile();
        }}
      />
      <PasswordSetupDialog
        open={showPasswordDialog}
        onComplete={async () => {
          if (user) localStorage.setItem(`flea_pw_done_${user.id}`, '1');
          localStorage.removeItem('flea_oauth_signup'); // Clean up OAuth flag
          setPasswordCompleted(true);
          openCarousel();
          await refreshProfile();
          supabase.auth.refreshSession();
        }}
      />
      <BottomNav />
    </div>
  );
};

export default Index;
