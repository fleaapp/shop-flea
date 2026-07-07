import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import FilterChip from '@/components/FilterChip';
import SwipeCard from '@/components/SwipeCard';
import FilterSheet, { FilterState } from '@/components/FilterSheet';
import SearchSheet from '@/components/SearchSheet';
import SaveSearchButton from '@/components/SaveSearchButton';
import WelcomeSetupDialog from '@/components/WelcomeSetupDialog';
import PasswordSetupDialog from '@/components/PasswordSetupDialog';

import { useListings, DbListing } from '@/hooks/useListings';
import { useHomeFeed } from '@/hooks/useHomeFeed';
import { useFavorites } from '@/hooks/useFavorites';
import { useDiscardedListings } from '@/hooks/useDiscardedListings';
import { useCart } from '@/context/CartContext';
import { useOnboarding } from '@/context/OnboardingContext';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { useGuestMode } from '@/context/GuestModeContext';
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
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const { isGuest, requireAuth } = useGuestMode();

  // Check if user needs to set up their profile.
  // Triggers when: profile is missing entirely, username is missing/blank,
  // username is the auto-generated placeholder, OR region/country is missing.
  // Any of these means the user hasn't completed onboarding and must be gated.
  // IMPORTANT: gate on `!authLoading` so we don't flash the welcome dialog
  // during the brief window after login when `user` is set but `profile`
  // hasn't been fetched yet.
  const needsProfileSetup = !!user && !authLoading && (
    !profile ||
    !profile.username ||
    profile.username.trim() === '' ||
    profile.username.startsWith('@user_') ||
    !profile.region_id ||
    !profile.country_code
  );
  // profileLoaded reflects "we've finished trying to load it", regardless of whether a row exists.
  // The AuthContext sets profile to null both when loading and when no row exists, so we treat
  // a missing row as "loaded" once the user is present and not in initial loading.
  const profileLoaded = !!user;
  // Persist `welcomeCompleted` per-user in localStorage. Without this, navigating
  // between routes during the onboarding carousel unmounts/remounts Index and
  // resets this flag to false — which, combined with a brief profile-refetch lag,
  // re-opens the WelcomeSetupDialog and creates a loop.
  const [welcomeCompleted, setWelcomeCompleted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return false; // initialised properly in the user-scoped effect below
  });
  const [passwordCompleted, setPasswordCompleted] = useState(false);

  // Sync welcomeCompleted from user-scoped localStorage once user is available
  useEffect(() => {
    if (user) {
      const done = localStorage.getItem(`flea_welcome_done_${user.id}`) === '1';
      if (done) setWelcomeCompleted(true);
    }
  }, [user]);
  
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
  
  // Maybe stack: listings the user marked "Maybe" (swipe down). Soft-saved for revisit at end of stack.
  // DISABLED for now — kept for future re-enable.
  const [maybeIds, setMaybeIds] = useState<Set<string>>(new Set());
  // Passed stack: session-tracked IDs that were passed (swipe left). Discarded is persistent; this lets us revisit them this session.
  const [passedIds, setPassedIds] = useState<Set<string>>(new Set());
  // Which queue are we currently viewing
  const [viewMode, setViewMode] = useState<'new' | 'maybe' | 'passed' | 'all'>('new');
  

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
    brands: [],
    priceRange: [0, 1000],
  });
  
  // Search query state
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Track the last action for undo functionality
  const [lastAction, setLastAction] = useState<{
    listingId: string;
    type: 'discard' | 'favorite' | 'cart' | 'maybe';
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
    if (appliedFilters.brands.length > 0) {
      filterObj.brands = appliedFilters.brands;
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

  // Use the personalised home feed (cart+wishlist signals, 70/30 mix) when no
  // filters or search are active. When the user filters or searches, fall back
  // to the standard filtered listings query so filtering keeps working.
  const hasActiveFilters = Object.keys(finalFilters).length > 0;
  const filteredQuery = useListings(finalFilters, { enabled: hasActiveFilters });
  const homeFeed = useHomeFeed();
  const { listings: dbListings, loading, loadMore, hasMore, loadingMore } =
    hasActiveFilters ? filteredQuery : homeFeed;

  // Auto-fetch next page when the unswiped stack is running low.
  useEffect(() => {
    if (!loading && !loadingMore && hasMore && dbListings.length > 0) {
      const remaining = dbListings.filter(l =>
        !discardedIds.has(l.id) && !favoriteIds.has(l.id) && !isInCart(l.id)
      ).length;
      if (remaining < 10) loadMore();
    }
  }, [dbListings, discardedIds, favoriteIds, isInCart, loading, loadingMore, hasMore, loadMore]);

  // Filter out listings that are favorited, in cart, or (when viewing 'new')
  // already passed/marked-maybe. Revisit modes intentionally bypass the
  // passed/maybe filters so users can swipe through those queues again.
  // IMPORTANT: while the top card is animating out, keep it in the stack so
  // the two cards behind don't collapse/disappear.
  const { newListings, maybeListings, passedListings, allRevisitListings } = useMemo(() => {
    const isInteractable = (id: string) => !favoriteIds.has(id) && !isInCart(id);
    const keepPending = (id: string) => pendingExitId === id;

    const newOnes = dbListings.filter((l) => {
      if (keepPending(l.id)) return true;
      if (!isInteractable(l.id)) return false;
      if (discardedIds.has(l.id) || passedIds.has(l.id)) return false;
      if (maybeIds.has(l.id)) return false;
      return true;
    });

    const maybes = dbListings.filter((l) => {
      if (keepPending(l.id) && maybeIds.has(l.id)) return true;
      if (l.id === pendingExitId) return false;
      return maybeIds.has(l.id) && isInteractable(l.id);
    });

    const passes = dbListings.filter((l) => {
      if (keepPending(l.id) && passedIds.has(l.id)) return true;
      if (l.id === pendingExitId) return false;
      return passedIds.has(l.id) && isInteractable(l.id);
    });

    const seen = new Set<string>();
    const combined: DbListing[] = [];
    [...maybes, ...passes].forEach((l) => {
      if (!seen.has(l.id)) {
        seen.add(l.id);
        combined.push(l);
      }
    });

    return { newListings: newOnes, maybeListings: maybes, passedListings: passes, allRevisitListings: combined };
  }, [dbListings, discardedIds, favoriteIds, isInCart, pendingExitId, maybeIds, passedIds]);

  // MAYBE queue auto-transition disabled — kept for future re-enable.
  // When the new-listings queue runs out, automatically transition into the Maybe queue
  // (if any) with a brief toast. Passed listings are NOT included here — they're only
  // refreshable via Settings → Refresh Passed Listings.
  // useEffect(() => {
  //   if (loading) return;
  //   if (viewMode !== 'new') return;
  //   if (newListings.length > 0) return;
  //   if (maybeIds.size === 0) return;
  //   toast('You\'ve seen all new listings. Now showing your Maybes 🤔.');
  //   setViewMode('maybe');
  // }, [loading, viewMode, newListings.length, maybeIds.size]);

  // // When the Maybe revisit queue empties, flip back to 'new'.
  // useEffect(() => {
  //   if (viewMode === 'maybe' && maybeListings.length === 0) setViewMode('new');
  // }, [viewMode, maybeListings.length]);

  const availableListings =
    viewMode === 'maybe' ? maybeListings
    : viewMode === 'passed' ? passedListings
    : viewMode === 'all' ? allRevisitListings
    : newListings;
  const currentListings = availableListings.slice(0, 3);

  const handleSwipeLeft = useCallback(async (listingId: string) => {
    if (pendingExitId) return;

    setPendingExitId(listingId);
    await addDiscarded(listingId);
    setPassedIds((prev) => {
      const next = new Set(prev);
      next.add(listingId);
      return next;
    });
    setMaybeIds((prev) => {
      if (!prev.has(listingId)) return prev;
      const next = new Set(prev);
      next.delete(listingId);
      return next;
    });
    setLastAction({ listingId, type: 'discard' });
  }, [addDiscarded, pendingExitId]);

  const handleSwipeRight = useCallback(async (listing: DbListing) => {
    if (pendingExitId) return;

    setPendingExitId(listing.id);
    await addFavorite(listing.id, toDisplayListing(listing));
    setLastAction({ listingId: listing.id, type: 'favorite' });
  }, [addFavorite, pendingExitId]);

  const handleSwipeUp = useCallback((listing: DbListing): boolean | void => {
    if (pendingExitId) return false;

    // Add to cart is an account-based action — guests must sign in.
    // Return false so the SwipeCard snaps back and the item stays on top
    // of the stack if the user picks "Continue Browsing".
    if (!requireAuth()) return false;

    setPendingExitId(listing.id);
    addToCart(toDisplayListing(listing));
    setLastAction({ listingId: listing.id, type: 'cart' });
  }, [addToCart, pendingExitId, requireAuth]);

  // MAYBE (swipe down) handler disabled — kept for future re-enable.
  // const handleSwipeDown = useCallback(async (listingId: string) => {
  //   if (pendingExitId) return;
  //   setPendingExitId(listingId);
  //   setMaybeIds((prev) => {
  //     const next = new Set(prev);
  //     next.add(listingId);
  //     return next;
  //   });
  //   // If the listing was previously passed/discarded, un-pass it so it lives in Maybe only.
  //   setPassedIds((prev) => {
  //     if (!prev.has(listingId)) return prev;
  //     const next = new Set(prev);
  //     next.delete(listingId);
  //     return next;
  //   });
  //   if (discardedIds.has(listingId)) {
  //     await removeDiscarded(listingId);
  //   }
  //   setLastAction({ listingId, type: 'maybe' });
  // }, [pendingExitId, discardedIds, removeDiscarded]);

  const handleSwipeDown = useCallback(() => {
    // Swipe down is currently disabled; maybe functionality saved for future re-enable.
  }, []);

  const handleUndo = useCallback(async () => {
    if (!lastAction) return;

    const { listingId, type } = lastAction;
    
    if (type === 'discard') {
      await removeDiscarded(listingId);
      setPassedIds((prev) => {
        if (!prev.has(listingId)) return prev;
        const next = new Set(prev);
        next.delete(listingId);
        return next;
      });
    } else if (type === 'favorite') {
      await removeFavorite(listingId);
    } else if (type === 'cart') {
      await removeFromCart(listingId);
    } else if (type === 'maybe') {
      setMaybeIds((prev) => {
        const next = new Set(prev);
        next.delete(listingId);
        return next;
      });
    }
    
    setLastAction(null);
    toast.success('Action undone!');
  }, [lastAction, removeDiscarded, removeFavorite, removeFromCart]);

  const handleTopExitComplete = useCallback(() => {
    setPendingExitId(null);
  }, []);

  const handleCardClick = (listing: DbListing) => {
    navigate(`/listing/${listing.id}`, { state: { listing: toDisplayListing(listing) } });
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
    appliedFilters.brands.forEach(brand => {
      chips.push({ label: brand.charAt(0).toUpperCase() + brand.slice(1), type: 'brand', value: brand });
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
      } else if (type === 'brand') {
        return { ...prev, brands: prev.brands.filter(b => b !== value) };
      }
      return prev;
    });
  };

  const handleSearchClick = () => {
    setSearchSheetOpen(true);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setViewMode('new');
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
    setViewMode('new');
    toast.success('Filters applied!');
  };

  // Convert listings for search sheet (still uses mock format)
  const searchListings = dbListings.map(toDisplayListing);

  return (
    <div className="fixed inset-0 flex flex-col bg-background overflow-hidden">
      <Header onSearchClick={handleSearchClick} onFilterClick={handleFilterClick} onUndoClick={handleUndo} canUndo={!!lastAction} />
      
      {/* Active Filters */}
      {(activeFilterChips.length > 0 || searchQuery) && (
        <div className="flex items-center gap-2 px-6 pb-2 flex-shrink-0 overflow-x-auto scrollbar-hide">
          <SaveSearchButton query={searchQuery} filters={listingFilters} />
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
              colourSwatch={activeFilterChips[0].colourSwatch}
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
                  brands: [],
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
            <div className="h-full w-full" />
          ) : currentListings.length > 0 ? (
            <>
              {currentListings.map((dbListing, index) => (
                <SwipeCard
                  key={dbListing.id}
                  listing={toDisplayListing(dbListing)}
                  onSwipeLeft={() => handleSwipeLeft(dbListing.id)}
                  onSwipeRight={() => handleSwipeRight(dbListing)}
                  onSwipeUp={() => handleSwipeUp(dbListing)}
                  // MAYBE (swipe down) disabled — kept for future re-enable.
                  // onSwipeDown={() => handleSwipeDown(dbListing.id)}
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
        currentFilters={listingFilters}
        onApplySavedSearch={(s) => {
          const f = s.filters || {};
          setAppliedFilters({
            preferences: false,
            hideSoldItems: appliedFilters.hideSoldItems,
            sizes: f.sizes || [],
            categories: f.categories || [],
            genders: f.genders || [],
            condition: f.condition || '',
            colours: f.colours || [],
            styles: f.styles || [],
            brands: f.brands || [],
            priceRange: [f.minPrice ?? 0, f.maxPrice ?? 1000],
          });
        }}
      />
      <WelcomeSetupDialog
        open={showWelcomeDialog}
        isGoogleUser={isGoogleUser}
        onComplete={() => {
          setWelcomeCompleted(true);
          if (user) localStorage.setItem(`flea_welcome_done_${user.id}`, '1');
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
