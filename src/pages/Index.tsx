import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import { loadSearchState, saveSearchState, clearSearchState } from '@/utils/searchPersistence';

import {
  markListingConsumed,
  unmarkListingConsumed,
  isListingConsumed,
  syncConsumedOwner,
} from '@/utils/consumedListings';


// Convert DbListing to Listing format for components that expect it
const toDisplayListing = (dbListing: DbListing): Listing => ({
  id: dbListing.id,
  title: dbListing.title,
  price: dbListing.price,
  shippingPrice: dbListing.shipping_price || 0,
  description: dbListing.description || '',
  image: (dbListing as any).thumbnails?.[0] || dbListing.images?.[0] || '',
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
  const { signupFlowStage, setSignupFlowStage, setSignupDialogOpen } = useOnboarding();
  const { user, profile, loading: authLoading, profileLoaded, refreshProfile } = useAuth();
  const { isGuest, requireAuth } = useGuestMode();

  // Check if user needs to set up their profile.
  // Triggers when: profile is missing entirely, username is missing/blank,
  // username is the auto-generated placeholder, OR region/country is missing.
  // Any of these means the user hasn't completed onboarding and must be gated.
  // IMPORTANT: gate on `profileLoaded` so we don't flash the welcome dialog
  // during the brief window on cold boot / resume when `user` is set but the
  // profile row is still being fetched.
  const needsProfileSetup = !!user && !authLoading && profileLoaded && (
    !profile ||
    !profile.username ||
    profile.username.trim() === '' ||
    profile.username.startsWith('@user_') ||
    !profile.region_id ||
    !profile.country_code
  );
  // `profileLoaded` comes from AuthContext and is true only after the profile
  // fetch has settled (success or empty). Used below to gate password logic.

  // Persist `welcomeCompleted` per-user in localStorage. Without this, navigating
  // between routes during the onboarding carousel unmounts/remounts Index and
  // resets this flag to false — which, combined with a brief profile-refetch lag,
  // re-opens the WelcomeSetupDialog and creates a loop.
  const [welcomeCompleted, setWelcomeCompleted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return false; // initialised properly in the user-scoped effect below
  });
  const [passwordCompleted, setPasswordCompleted] = useState(false);

  // Keep the session "consumed" deck set scoped to the signed-in user.
  useEffect(() => {
    syncConsumedOwner(user?.id ?? null);
  }, [user?.id]);


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
  
  // ---- Identity-based OAuth detection (single source of truth) ----
  // The localStorage flag is only a hint for the very first render after the
  // OAuth redirect; the account's identities are authoritative and never get
  // cleared out from under us, so both code paths always agree.
  const hasEmailIdentity = user?.identities?.some((id: any) => id.provider === 'email') ?? false;

  const isOAuthUser =
    !hasEmailIdentity && (
      user?.app_metadata?.provider === 'google' ||
      user?.app_metadata?.provider === 'apple' ||
      user?.app_metadata?.providers?.includes('google') ||
      user?.app_metadata?.providers?.includes('apple') ||
      (user?.identities?.some((id: any) => id.provider === 'google' || id.provider === 'apple') ?? false) ||
      localStorage.getItem('flea_oauth_signup') === '1'
    );
  const isGoogleUser = isOAuthUser;

  const passwordSetInMeta = user?.user_metadata?.password_set === true;
  const passwordSetInProfile = profile?.password_set === true;
  const passwordAlreadySet = passwordSetInMeta || passwordSetInProfile;

  // ---- Ordered signup state machine ----
  //   1. username / name  ->  2. password (OAuth only)  ->  3. walkthrough  ->  4. welcome alert
  // Exactly one stage is active at a time; nothing else may open the walkthrough.
  const needsPasswordSetup =
    !!user && profileLoaded && isOAuthUser && !passwordAlreadySet && !passwordCompleted;

  const showWelcomeDialog = needsProfileSetup && !welcomeCompleted;
  const showPasswordDialog = !showWelcomeDialog && needsPasswordSetup;

  const signupStage: 'username' | 'password' | 'walkthrough' | null = !user
    ? null
    : showWelcomeDialog
      ? 'username'
      : showPasswordDialog
        ? 'password'
        : profileLoaded
          ? 'walkthrough'
          : null;

  // Reconcile the durable controller with the account's actual setup state.
  // This also self-heals an app close between a successful save and its UI callback.
  useEffect(() => {
    if (!user || !profileLoaded || authLoading) return;
    if (showWelcomeDialog) {
      if (signupFlowStage !== 'profile') setSignupFlowStage('profile');
      return;
    }
    if (showPasswordDialog) {
      if (signupFlowStage !== 'password') setSignupFlowStage('password');
      return;
    }
    if (signupFlowStage === 'profile' || signupFlowStage === 'password') {
      setSignupFlowStage('walkthrough');
      return;
    }
    if (!signupFlowStage) {
      const pending = localStorage.getItem('flea-new-user-pending-onboarding') === 'true';
      const passwordWasSaved = localStorage.getItem(`flea_pw_done_${user.id}`) === '1';
      const welcomeWasSent = localStorage.getItem(`flea_welcome_notified_${user.id}`) === '1';
      // One-time recovery for accounts stranded by the previous implementation
      // after password save. Completed users are excluded by the welcome marker.
      if (pending && passwordWasSaved && !welcomeWasSent) {
        setSignupFlowStage('walkthrough');
        return;
      }
      // A completed returning account must not inherit the generic OAuth
      // intent set before we know whether Google/Apple returned a new account.
      localStorage.removeItem('flea-new-user-pending-onboarding');
    }
  }, [user, profileLoaded, authLoading, showWelcomeDialog, showPasswordDialog, signupFlowStage, setSignupFlowStage]);

  // Tell the app chrome that a signup dialog owns the screen.
  useEffect(() => {
    setSignupDialogOpen(signupStage === 'username' || signupStage === 'password');
    return () => setSignupDialogOpen(false);
  }, [signupStage, setSignupDialogOpen]);

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
  const DEFAULT_FILTERS: FilterState = {
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
  };

  const persistedSearch = useMemo(() => loadSearchState<FilterState>(), []);

  const [appliedFilters, setAppliedFilters] = useState<FilterState>(
    persistedSearch?.filters ? { ...DEFAULT_FILTERS, ...persistedSearch.filters } : DEFAULT_FILTERS
  );

  // Search query state
  const [searchQuery, setSearchQuery] = useState<string>(persistedSearch?.query ?? '');

  
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

  // Persist the active search + filters so they survive navigating away and back.
  useEffect(() => {
    const hasState = !!searchQuery || Object.keys(listingFilters).length > 0;
    if (hasState) {
      saveSearchState<FilterState>(searchQuery, appliedFilters);
    } else {
      clearSearchState();
    }
  }, [searchQuery, listingFilters, appliedFilters]);



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
      // Consumed = actioned this session (swipe or listing-details footer).
      // Checked synchronously so the deck never flashes an actioned card
      // while favourites/discards re-fetch after a remount.
      if (isListingConsumed(l.id)) return false;
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
    markListingConsumed(listingId, user?.id ?? null);
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
  }, [addDiscarded, pendingExitId, user?.id]);

  const handleSwipeRight = useCallback(async (listing: DbListing) => {
    if (pendingExitId) return;

    setPendingExitId(listing.id);
    markListingConsumed(listing.id, user?.id ?? null);
    await addFavorite(listing.id, toDisplayListing(listing));
    setLastAction({ listingId: listing.id, type: 'favorite' });
  }, [addFavorite, pendingExitId, user?.id]);

  const handleSwipeUp = useCallback((listing: DbListing): boolean | void => {
    if (pendingExitId) return false;

    // Add to cart is an account-based action — guests must sign in.
    // Return false so the SwipeCard snaps back and the item stays on top
    // of the stack if the user picks "Continue Browsing".
    if (!requireAuth()) return false;

    setPendingExitId(listing.id);
    markListingConsumed(listing.id, user?.id ?? null);
    addToCart(toDisplayListing(listing));
    setLastAction({ listingId: listing.id, type: 'cart' });
  }, [addToCart, pendingExitId, requireAuth, user?.id]);

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

  const handleUndo = useCallback(async () => {
    if (!lastAction) return;

    const { listingId, type } = lastAction;
    unmarkListingConsumed(listingId);
    
    
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
    }
    // MAYBE undo branch disabled — kept for future re-enable.
    // } else if (type === 'maybe') {
    //   setMaybeIds((prev) => {
    //     const next = new Set(prev);
    //     next.delete(listingId);
    //     return next;
    //   });
    // }
    
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
    <div className="native-safe-top fixed inset-0 flex flex-col bg-background overflow-hidden">
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
              <button aria-label="Close"
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
            <div className="h-full w-full flex flex-col gap-3">
              <Skeleton className="flex-1 w-full rounded-3xl" />
              <div className="space-y-2 px-1">
                <Skeleton className="h-4 w-2/3 rounded-md" />
                <Skeleton className="h-3 w-1/3 rounded-md" />
              </div>
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
                  // MAYBE (swipe down) disabled — kept for future re-enable.
                  // onSwipeDown={() => handleSwipeDown(dbListing.id)}
                  onExitComplete={index === 0 ? handleTopExitComplete : undefined}
                  onClick={() => handleCardClick(dbListing)}
                  isTop={index === 0}
                  index={index}
                />
              ))}
            </>
          ) : (activeFilterChips.length > 0 || searchQuery) ? (
            <div className="flex h-full flex-col items-center justify-center text-center px-4">
              <span className="text-5xl mb-3">🔍</span>
              <p className="text-lg font-medium text-muted-foreground">Nothing matched that</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Try fewer filters or a different search.
              </p>
              <Button
                onClick={() => {
                  clearSearch();
                  setAppliedFilters({
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
                }}
                className="mt-6 rounded-full bg-primary text-primary-foreground"
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center px-4">
              <span className="text-5xl mb-3">😢</span>
              <p className="text-lg font-medium text-muted-foreground">No more listings!</p>
              <p className="mt-2 text-sm text-muted-foreground">Check back later for new items</p>
              <div className="mt-6 grid w-[260px] grid-cols-2 gap-2">
                <Button
                  onClick={() => navigate('/favorites')}
                  className="w-full rounded-full bg-primary text-primary-foreground"
                >
                  Wishlist
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/cart')}
                  className="w-full rounded-full"
                >
                  Cart
                </Button>
              </div>
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
          setSignupFlowStage(isOAuthUser ? 'password' : 'walkthrough');
          void refreshProfile();
        }}
      />
      <PasswordSetupDialog
        open={showPasswordDialog}
        onComplete={async () => {
          if (user) localStorage.setItem(`flea_pw_done_${user.id}`, '1');
          localStorage.removeItem('flea_oauth_signup'); // Clean up OAuth flag
          setPasswordCompleted(true);
          await refreshProfile();
          setSignupFlowStage('walkthrough');
          void supabase.auth.refreshSession();
        }}
      />
      <BottomNav />
    </div>
  );
};

export default Index;
