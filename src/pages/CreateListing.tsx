import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ImagePlus, X, ChevronRight } from 'lucide-react';
import ListingImageCropDialog from '@/components/ListingImageCropDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import BottomNav from '@/components/BottomNav';
import SizeSelectionDrawer from '@/components/SizeSelectionDrawer';
import CategorySelectionDrawer from '@/components/CategorySelectionDrawer';
import TieredShippingSetupModal from '@/components/TieredShippingSetupModal';
import BlockedUserBanner from '@/components/BlockedUserBanner';
import ShippingSettingsSheet from '@/components/ShippingSettingsSheet';
import SellerOnboardingSheet from '@/components/SellerOnboardingSheet';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/utils/imageCompression';
import { loadShippingPrefs } from '@/utils/shippingPrefs';
import { useContentModeration } from '@/hooks/useContentModeration';
import { useBlockedStatus } from '@/hooks/useBlockedStatus';
import { invokeCloudFunction } from '@/utils/cloudFunctions';
import { clearStripeConnectionState, getStripeConnectedStorageKey } from '@/utils/stripeConnectionState';
import { 
  FIT_OPTIONS, 
  CATEGORY_OPTIONS,
  CONDITIONS,
  COLOURS,
  STYLES,
  isShoeCategory
} from '@/config/sizeConfig';
import { COLOUR_SWATCHES } from '@/utils/colourSwatches';
import ConditionInfoPopover from '@/components/ConditionInfoPopover';
import BrandAutocomplete from '@/components/BrandAutocomplete';
import { safeNavigateBack } from '@/utils/safeBack';
import { forceRestoreRouteAppChrome } from '@/lib/appChrome';
import PageSkeleton from '@/components/PageSkeleton';

interface ImageFile {
  file: File;
  preview: string;
}

const CreateListing = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const { checkListingContent, isChecking } = useContentModeration();
  const { isBlocked } = useBlockedStatus();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [imageFiles, setImageFiles] = useState<ImageFile[]>([]);
  const [expandedImageIndex, setExpandedImageIndex] = useState<number | null>(null);
  const [sizeDrawerOpen, setSizeDrawerOpen] = useState(false);
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [showShippingSetup, setShowShippingSetup] = useState(false);
  const [shippingChecked, setShippingChecked] = useState(false);
  const [showVerifyingDialog, setShowVerifyingDialog] = useState(false);
  const [showShippingSettings, setShowShippingSettings] = useState(false);
  const [paymentGateOpen, setPaymentGateOpen] = useState(true);

  // Check if seller has connected a payment method
  const hasPaymentMethodDB = profile?.stripe_onboarding_complete === true;
  const stripeLocalKey = user ? getStripeConnectedStorageKey(user.id) : null;
  const getLocalFlag = () => typeof window !== 'undefined' && !!stripeLocalKey && localStorage.getItem(stripeLocalKey) === 'true';
  const [hasPaymentMethodStripe, setHasPaymentMethodStripe] = useState(() => typeof window !== 'undefined' && !!stripeLocalKey && localStorage.getItem(stripeLocalKey) === 'true');
  const [stripeActionRequired, setStripeActionRequired] = useState(false);

  // PayPal removed from seller flow.
  const hasPayPalConnected = false;

  // Keep local payment state aligned with backend resets
  useEffect(() => {
    if (!user) {
      setHasPaymentMethodStripe(false);
      setStripeActionRequired(false);
      return;
    }

    const dbStripeDisconnected = !profile?.stripe_account_id && profile?.stripe_onboarding_complete !== true;
    if (dbStripeDisconnected) {
      clearStripeConnectionState(user.id);
      setHasPaymentMethodStripe(false);
      setStripeActionRequired(false);
      return;
    }

    setHasPaymentMethodStripe(getLocalFlag());
  }, [profile?.stripe_account_id, profile?.stripe_onboarding_complete, stripeLocalKey, user]);

  // Check Stripe for action required state (charges enabled but payouts paused)
  useEffect(() => {
    if (!user || !profile?.stripe_account_id) return;
    let cancelled = false;

    const checkStripeState = async () => {
      try {
        const { data, error } = await invokeCloudFunction('stripe-connect-status', {
          stripeAccountId: profile.stripe_account_id,
        });
        if (cancelled || error) return;

        if (data?.chargesEnabled && !data?.payoutsEnabled) {
          setStripeActionRequired(true);
          setHasPaymentMethodStripe(false);
        } else if (data?.chargesEnabled && data?.payoutsEnabled) {
          setStripeActionRequired(false);
          setHasPaymentMethodStripe(true);
          if (stripeLocalKey) localStorage.setItem(stripeLocalKey, 'true');
        }
      } catch (e) {
        console.error('Stripe state check failed:', e);
      }
    };

    checkStripeState();
    return () => { cancelled = true; };
  }, [user, profile?.stripe_account_id]);

  const hasPaymentMethod = hasPaymentMethodDB || hasPaymentMethodStripe || hasPayPalConnected;

  // Only show "verifying" if user just returned from Stripe with success param
  // or if they have a completed account in DB that needs syncing
  const stripeAccountId = profile?.stripe_account_id || null;
  const returnedFromStripe = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('stripe_success') === 'true';
  const stripePending = !hasPaymentMethod && returnedFromStripe;


  
  // Tiered shipping state
  const [tieredShippingEnabled, setTieredShippingEnabled] = useState<boolean | null>(null);
  const [tier1Price, setTier1Price] = useState<number | null>(null);
  
  const [productName, setProductName] = useState('');
  const [fit, setFit] = useState(''); // Gender/Fit selection
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [size, setSize] = useState('');
  const [brand, setBrand] = useState('');
  const [condition, setCondition] = useState('');
  const [colours, setColours] = useState<string[]>([]);
  const [styles, setStyles] = useState<string[]>([]);
  const [itemPrice, setItemPrice] = useState('');
  const [shippingPrice, setShippingPrice] = useState('');
  const [description, setDescription] = useState('');

  // Reset dependent fields when parent selection changes
  const handleFitChange = (value: string) => {
    setFit(value);
    setSize(''); // Only reset size, keep category
  };

  const handleCategorySelect = (cat: string, subcat: string) => {
    setCategory(cat);
    setSubcategory(subcat);
    setSize(''); // Reset size when category changes
  };

  // Helper to get display label for category
  const getCategoryDisplayLabel = () => {
    const cat = CATEGORY_OPTIONS.find(c => c.value === category);
    if (!cat) return "Category";
    const subcats = cat.subcategories as readonly { value: string; label: string }[];
    const subcat = subcats?.find(s => s.value === subcategory);
    return cat.label + (subcat ? ` - ${subcat.label}` : '');
  };

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      toast.error('Please sign in to create a listing');
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Check if shipping preferences need to be set and load tiered shipping state
  useEffect(() => {
    // Only check shipping AFTER payment gate is resolved
    if (!authLoading && user && profile && !shippingChecked && hasPaymentMethod) {
      setShippingChecked(true);

      // First-time sellers MUST complete shipping setup if they haven't explicitly saved preferences
      const needsShippingSetup = profile.shipping_preferences_set !== true;

      if (needsShippingSetup) {
        setShowShippingSetup(true);
        return;
      }

      // Only use cached/profile shipping data for returning sellers
      const localPrefs = loadShippingPrefs(user.id);
      if (localPrefs) {
        setTieredShippingEnabled(localPrefs.tieredEnabled);
        if (localPrefs.tieredEnabled) {
          setTier1Price(localPrefs.tier1);
          setShippingPrice(localPrefs.tier1.toString());
        }
        return;
      }

      // Fall back to profile data
      setTieredShippingEnabled(profile.tiered_shipping_enabled ?? false);
      if (profile.tiered_shipping_enabled && profile.shipping_tier_1 != null) {
        setTier1Price(profile.shipping_tier_1);
        setShippingPrice(profile.shipping_tier_1.toString());
      }
    }
  }, [user, profile, authLoading, shippingChecked, hasPaymentMethod]);

  const handleShippingSetupComplete = async () => {
    setShowShippingSetup(false);
    await refreshProfile();
    
    // Reload shipping prefs after setup — try localStorage first, then re-fetch profile
    if (user) {
      const localPrefs = loadShippingPrefs(user.id);
      if (localPrefs) {
        setTieredShippingEnabled(localPrefs.tieredEnabled);
        if (localPrefs.tieredEnabled) {
          setTier1Price(localPrefs.tier1);
          setShippingPrice(localPrefs.tier1.toString());
        } else {
          setTieredShippingEnabled(false);
        }
        return;
      }

      // Fallback: read directly from DB in case localStorage wasn't used
      const { data } = await supabase
        .from('profiles')
        .select('tiered_shipping_enabled, shipping_tier_1, shipping_tier_2, shipping_tier_3')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setTieredShippingEnabled(data.tiered_shipping_enabled ?? false);
        if (data.tiered_shipping_enabled && data.shipping_tier_1 != null) {
          setTier1Price(data.shipping_tier_1);
          setShippingPrice(data.shipping_tier_1.toString());
        }
      }
    }
  };

  const handleShippingSetupCancel = () => {
    setShowShippingSetup(false);
    // Navigate back since they can't proceed without setting shipping
    navigate(-1);
  };

  // Crop queue state
  const [cropQueue, setCropQueue] = useState<string[]>([]);
  const [currentCropSrc, setCurrentCropSrc] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remainingSlots = 5 - imageFiles.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    // Create object URLs and queue them for cropping
    const srcs = filesToProcess.map((f) => URL.createObjectURL(f));
    setCropQueue(srcs);
    setCurrentCropSrc(srcs[0] || null);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCropComplete = useCallback(async (croppedBlob: Blob) => {
    // Compress cropped blob
    const croppedFile = new File([croppedBlob], `cropped-${Date.now()}.jpg`, { type: 'image/jpeg' });
    try {
      const compressedFile = await compressImage(croppedFile);
      const preview = URL.createObjectURL(compressedFile);
      setImageFiles((prev) => [...prev, { file: compressedFile, preview }]);
    } catch {
      const preview = URL.createObjectURL(croppedFile);
      setImageFiles((prev) => [...prev, { file: croppedFile, preview }]);
    }

    // Revoke current crop src and advance queue
    if (currentCropSrc) URL.revokeObjectURL(currentCropSrc);
    setCropQueue((prev) => {
      const next = prev.slice(1);
      setCurrentCropSrc(next[0] || null);
      return next;
    });
  }, [currentCropSrc]);

  const handleCropCancel = useCallback(() => {
    // Skip this image, advance queue
    if (currentCropSrc) URL.revokeObjectURL(currentCropSrc);
    setCropQueue((prev) => {
      const next = prev.slice(1);
      setCurrentCropSrc(next[0] || null);
      return next;
    });
  }, [currentCropSrc]);

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const removeImage = (index: number) => {
    setImageFiles((prev) => {
      const removed = prev[index];
      URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadImages = async (): Promise<string[]> => {
    if (!user) return [];
    
    const uploadedUrls: string[] = [];
    
    for (const imageFile of imageFiles) {
      const fileExt = imageFile.file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error } = await supabase.storage
        .from('listings')
        .upload(fileName, imageFile.file);
      
      if (error) {
        console.error('Upload error:', error);
        throw new Error('Failed to upload image');
      }
      
      const { data: { publicUrl } } = supabase.storage
        .from('listings')
        .getPublicUrl(fileName);
      
      uploadedUrls.push(publicUrl);
    }
    
    return uploadedUrls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Please sign in to create a listing');
      navigate('/auth');
      return;
    }

    // Check if user is blocked
    if (isBlocked) {
      toast.error('Your account is restricted. You cannot create listings.');
      return;
    }
    
    if (!productName || !fit || !category || !size || !brand || !condition || !itemPrice) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    if (imageFiles.length === 0) {
      toast.error('Please add at least one image');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Check content for moderation before uploading
      const moderationResult = await checkListingContent({
        title: productName,
        description: description || undefined,
        brand,
      });

      if (moderationResult.isBlocked) {
        setIsLoading(false);
        return; // Error toast already shown by hook
      }

      // Upload images to storage
      const imageUrls = await uploadImages();
      
      // Create the listing with region from user's profile
      const listingData: Record<string, any> = {
          user_id: user.id,
          title: productName,
          description: description || null,
          brand,
          size,
          category,
          subcategory: subcategory || null,
          condition,
          colour: colours.length > 0 ? colours.join(', ') : null,
          style: styles.length > 0 ? styles.join(', ') : null,
          gender: fit || null,
          price: parseFloat(itemPrice),
          shipping_price: shippingPrice ? parseFloat(shippingPrice) : 0,
          images: imageUrls,
          tags: [brand, category].filter(Boolean),
          status: 'active',
          region_id: profile?.region_id || null,
          country_code: profile?.country_code || null,
        };

      let { error } = await supabase.from('listings').insert(listingData);

      // Retry without the column that triggered a 42703 / PGRST204 cache miss
      if (error && (error.code === '42703' || error.code === 'PGRST204') && error.message?.includes('subcategory')) {
        const { subcategory: _dropped, ...withoutSubcat } = listingData;
        const retry = await supabase.from('listings').insert(withoutSubcat);
        error = retry.error;
      }

      if (error) {
        throw error;
      }
      
      toast.success('🎉 Listing posted!');
      navigate('/profile');
    } catch (error: any) {
      console.error('Error creating listing:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      const message = error?.message || error?.error_description || 'Please try again.';
      toast.error(`Failed to create listing: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyles = "h-14 rounded-2xl bg-muted/50 border border-muted-foreground/20 placeholder:text-muted-foreground/60 focus-visible:ring-muted-foreground/50";
  const selectStyles = "h-14 rounded-2xl bg-muted/50 border border-muted-foreground/20 [&>span]:text-muted-foreground/60 [&>span]:text-base focus:ring-muted-foreground/50";

  // Show loading only while auth is loading
  if (authLoading) {
    return <PageSkeleton />;
  }

  // Show verifying dialog if Stripe is pending (account exists but not yet connected)
  if (stripePending && user && profile) {
    return (
      <div className="min-h-screen bg-background pb-24 pt-[env(safe-area-inset-top)]">
        <header className="relative flex items-center justify-center px-4 py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="absolute left-4 h-10 w-10 rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Add New Listing</h1>
        </header>
        <Dialog open={true} onOpenChange={() => {}}>
          <DialogContent hideCloseButton className="w-[88vw] max-w-sm rounded-3xl border-[3px] border-charcoal bg-card p-6 pt-10 pb-8" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
            <DialogHeader className="space-y-2">
              <DialogTitle className="text-center text-lg">
                Verifying Your Connection
              </DialogTitle>
              <DialogDescription className="text-center text-balance max-w-[260px] mx-auto">
                Your Stripe account is being verified. This can take a couple of minutes. Please check back shortly!
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 flex flex-col items-center">
              <Button
                variant="ghost"
                onClick={() => navigate('/settings')}
                className="w-64 h-11 rounded-full bg-charcoal text-white hover:bg-charcoal-light border-none shadow-none ring-0 outline-none focus-visible:ring-0"
              >
                Go to Settings
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <BottomNav />
      </div>
    );
  }

  // Show payment gate if user has no fully connected payment method or action required
  const needsPaymentGate = !hasPaymentMethod || (stripeActionRequired && !hasPayPalConnected);
  if (needsPaymentGate && user && profile) {
    return (
      <div className="min-h-svh bg-background">
        <SellerOnboardingSheet
          open={paymentGateOpen}
          onOpenChange={(v) => {
            setPaymentGateOpen(v);
            if (!v) {
              forceRestoreRouteAppChrome();
              safeNavigateBack(navigate, '/profile');
            }
          }}
          stripeActionRequired={stripeActionRequired}
          returnUrl={typeof window !== 'undefined' ? window.location.origin + '/profile' : undefined}
          onComplete={() => setPaymentGateOpen(false)}
        />
      </div>
    );
  }

  // Block form until shipping setup is complete for first-time sellers
  if (showShippingSetup) {
    return (
      <div className="min-h-screen bg-background pb-24 pt-[env(safe-area-inset-top)]">
        <header className="relative flex items-center justify-center px-4 py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="absolute left-4 h-10 w-10 rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Add New Listing</h1>
        </header>
        <TieredShippingSetupModal
          open={true}
          onComplete={handleShippingSetupComplete}
          onCancel={handleShippingSetupCancel}
        />
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 pt-[env(safe-area-inset-top)]">
      {/* Blocked user banner */}
      {isBlocked && <BlockedUserBanner />}
      {/* Image Crop Dialog */}
      {currentCropSrc && (
        <ListingImageCropDialog
          open={true}
          imageSrc={currentCropSrc}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* Header */}
      <header className="relative flex items-center justify-center px-4 py-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="absolute left-4 h-10 w-10 rounded-full"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold text-foreground">Add New Listing</h1>
      </header>
      
      <form onSubmit={handleSubmit} className="px-4 space-y-4">
        {/* Photo Upload Area */}
        <button
          type="button"
          onClick={triggerFileInput}
          className="w-full h-32 rounded-2xl bg-muted/50 border border-muted-foreground/20 flex flex-col items-center justify-center gap-2"
        >
          <ImagePlus className="h-8 w-8 text-muted-foreground/60" />
          <span className="text-sm text-muted-foreground/60">Add photos ({imageFiles.length}/5)</span>
        </button>

        {/* Image Thumbnails */}
        {imageFiles.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-2 pt-1 px-1 -mx-1">
            {imageFiles.map((img, index) => (
              <div key={index} className="relative flex-shrink-0">
                <img
                  src={img.preview}
                  alt={`Upload ${index + 1}`}
                  className="h-16 w-16 rounded-lg object-cover cursor-pointer active:scale-95 transition-transform"
                  onClick={() => setExpandedImageIndex(index)}
                />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeImage(index); }}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-foreground/80 text-background"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Expanded Image Viewer */}
        <Dialog open={expandedImageIndex !== null} onOpenChange={(o) => { if (!o) setExpandedImageIndex(null); }}>
          <DialogContent hideCloseButton className="max-w-[92vw] w-[400px] p-0 rounded-3xl overflow-hidden bg-background border-0">
            <DialogTitle className="sr-only">Photo preview</DialogTitle>
            {expandedImageIndex !== null && imageFiles[expandedImageIndex] && (
              <img
                src={imageFiles[expandedImageIndex].preview}
                alt={`Photo ${expandedImageIndex + 1}`}
                className="w-full aspect-[4/5] object-cover"
              />
            )}
          </DialogContent>
        </Dialog>
        
        {/* Product Name */}
        <Input
          placeholder="Product name"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          className={inputStyles}
        />
        
        {/* Fit / Gender */}
        <Select value={fit} onValueChange={handleFitChange}>
          <SelectTrigger className={`${selectStyles} ${fit ? '[&>span]:text-foreground' : ''}`}>
            <SelectValue placeholder="Fit / Gender" />
          </SelectTrigger>
          <SelectContent>
            {FIT_OPTIONS.map((f) => (
              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Category - Opens Drawer */}
        <button
          type="button"
          onClick={() => setCategoryDrawerOpen(true)}
          className={`${inputStyles} w-full flex items-center justify-between px-4 text-left`}
        >
          <span className={category ? 'text-foreground' : 'text-muted-foreground/60'}>
            {category ? getCategoryDisplayLabel() : "Category"}
          </span>
          <ChevronRight className="h-5 w-5 text-muted-foreground/60" />
        </button>

        {/* Size - Opens Drawer */}
        <button
          type="button"
          onClick={() => setSizeDrawerOpen(true)}
          disabled={!fit || !category}
          className={`${inputStyles} w-full flex items-center justify-between px-4 text-left ${
            !fit || !category ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <span className={size ? 'text-foreground' : 'text-muted-foreground/60'}>
            {size ? size.toUpperCase() : (!fit ? "Select Fit first" : !category ? "Select Category first" : "Size")}
          </span>
          <ChevronRight className="h-5 w-5 text-muted-foreground/60" />
        </button>

        {/* Brand - Autocomplete */}
        <BrandAutocomplete
          value={brand}
          onChange={setBrand}
          className={inputStyles}
        />
        
        {/* Condition */}
        <div className="flex items-center gap-2">
          <ConditionInfoPopover />
          <Select value={condition} onValueChange={setCondition}>
            <SelectTrigger className={`${selectStyles} flex-1 ${condition ? '[&>span]:text-foreground' : ''}`}>
              <SelectValue placeholder="Condition" />
            </SelectTrigger>
            <SelectContent>
              {CONDITIONS.map((c) => (
                <SelectItem key={c} value={c.toLowerCase()}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Colour - Multi-select bubbles */}
        <div className={`${inputStyles} min-h-14 h-auto py-3 px-4`}>
          <p className={`text-sm mb-2 ${colours.length > 0 ? 'text-foreground font-medium' : 'text-muted-foreground/60'}`}>
            {colours.length > 0 ? `Colour (${colours.length} selected)` : 'Colour'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {COLOURS.map((c) => {
              const isSelected = colours.includes(c.toLowerCase());
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      setColours(colours.filter(col => col !== c.toLowerCase()));
                    } else {
                      setColours([...colours, c.toLowerCase()]);
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    isSelected ? 'bg-primary text-foreground' : 'bg-muted text-foreground hover:bg-muted/80'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full flex-shrink-0 border border-border/40"
                    style={{ background: COLOUR_SWATCHES[c] || COLOUR_SWATCHES['Multi / Patterned'] }}
                  />
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        {/* Style - Multi-select bubbles */}
        <div className={`${inputStyles} min-h-14 h-auto py-3 px-4`}>
          <p className={`text-sm mb-2 ${styles.length > 0 ? 'text-foreground font-medium' : 'text-muted-foreground/60'}`}>
            {styles.length > 0 ? `Style (${styles.length} selected)` : 'Style'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {STYLES.map((s) => {
              const isSelected = styles.includes(s.toLowerCase());
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      setStyles(styles.filter(st => st !== s.toLowerCase()));
                    } else {
                      setStyles([...styles, s.toLowerCase()]);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    isSelected ? 'bg-primary text-foreground' : 'bg-muted text-foreground hover:bg-muted/80'
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Item Price */}
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 font-medium">$</span>
          <Input
            type="number"
            placeholder="Item price"
            value={itemPrice}
            onChange={(e) => setItemPrice(e.target.value)}
            className={`${inputStyles} pl-8`}
          />
        </div>

        {/* Shipping Price */}
        <div className="relative" onClick={tieredShippingEnabled ? () => setShowShippingSettings(true) : undefined}>
          <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-medium ${tieredShippingEnabled ? 'text-muted-foreground/40' : 'text-muted-foreground/60'}`}>$</span>
          <Input
            type="number"
            placeholder="Shipping price"
            value={shippingPrice}
            onChange={(e) => setShippingPrice(e.target.value)}
            disabled={tieredShippingEnabled === true}
            className={`${inputStyles} pl-8 pr-32 ${tieredShippingEnabled ? 'opacity-60 cursor-pointer' : ''}`}
            style={tieredShippingEnabled ? { pointerEvents: 'none' } : undefined}
          />
          <span
            className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60 cursor-pointer"
            onClick={(e) => { e.stopPropagation(); setShowShippingSettings(true); }}
          >
            {tieredShippingEnabled ? 'Tiered shipping ›' : 'Shipping settings ›'}
          </span>
        </div>
        
        {/* Description */}
        <Textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="min-h-[120px] rounded-2xl bg-muted/50 border border-muted-foreground/20 resize-none placeholder:text-muted-foreground/60 focus-visible:ring-muted-foreground/50"
        />
        
        {/* Submit Button */}
        <div className="flex justify-center pt-4 pb-8">
          <Button
            type="submit"
            disabled={isLoading}
            className="h-12 px-8 rounded-full bg-foreground text-background font-medium hover:bg-foreground/90"
          >
            {isLoading ? 'Posting...' : 'Post listing'}
          </Button>
        </div>
      </form>
      
      <SizeSelectionDrawer
        open={sizeDrawerOpen}
        onOpenChange={setSizeDrawerOpen}
        fit={fit}
        category={isShoeCategory(category) ? 'shoes' : 'clothing'}
        selectedSize={size}
        onSelectSize={setSize}
      />
      
      <CategorySelectionDrawer
        open={categoryDrawerOpen}
        onOpenChange={setCategoryDrawerOpen}
        selectedCategory={category}
        selectedSubcategory={subcategory}
        onSelectCategory={handleCategorySelect}
      />

      <TieredShippingSetupModal
        open={showShippingSetup}
        onComplete={handleShippingSetupComplete}
        onCancel={handleShippingSetupCancel}
      />

      <ShippingSettingsSheet
        open={showShippingSettings}
        onOpenChange={(open) => {
          setShowShippingSettings(open);
          if (!open && user) {
            const localPrefs = loadShippingPrefs(user.id);
            if (localPrefs) {
              setTieredShippingEnabled(localPrefs.tieredEnabled);
              if (localPrefs.tieredEnabled) {
                setTier1Price(localPrefs.tier1);
                setShippingPrice(localPrefs.tier1.toString());
              } else {
                setShippingPrice('');
              }
            }
            refreshProfile();
          }
        }}
      />
      
      <BottomNav />
    </div>
  );
};

export default CreateListing;
