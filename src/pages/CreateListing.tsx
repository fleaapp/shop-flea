import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ImagePlus, X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import BottomNav from '@/components/BottomNav';
import SizeSelectionDrawer from '@/components/SizeSelectionDrawer';
import CategorySelectionDrawer from '@/components/CategorySelectionDrawer';
import TieredShippingSetupModal from '@/components/TieredShippingSetupModal';
import BlockedUserBanner from '@/components/BlockedUserBanner';
import ConnectPaymentDialog from '@/components/ConnectPaymentDialog';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/utils/imageCompression';
import { loadShippingPrefs } from '@/utils/shippingPrefs';
import { useContentModeration } from '@/hooks/useContentModeration';
import { useBlockedStatus } from '@/hooks/useBlockedStatus';
import { 
  FIT_OPTIONS, 
  CATEGORY_OPTIONS,
  CONDITIONS,
  COLOURS,
  STYLES,
  isShoeCategory
} from '@/config/sizeConfig';

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
  const [sizeDrawerOpen, setSizeDrawerOpen] = useState(false);
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [showShippingSetup, setShowShippingSetup] = useState(false);
  const [shippingChecked, setShippingChecked] = useState(false);
  const [showPaymentGate, setShowPaymentGate] = useState(false);
  const [stripeReturnHandled, setStripeReturnHandled] = useState(false);

  // Check if seller has connected a payment method
  // Use localStorage as persistent fallback to survive component remounts
  const hasPaymentMethodDB = profile?.stripe_onboarding_complete === true;
  const stripeLocalKey = user ? `flea_stripe_connected_${user.id}` : null;
  const getLocalFlag = () => typeof window !== 'undefined' && !!stripeLocalKey && localStorage.getItem(stripeLocalKey) === 'true';
  const initialLocalFlag = typeof window !== 'undefined' && !!stripeLocalKey && localStorage.getItem(stripeLocalKey) === 'true';
  const [hasPaymentMethodStripe, setHasPaymentMethodStripe] = useState(initialLocalFlag);
  const [paymentCheckDone, setPaymentCheckDone] = useState(hasPaymentMethodDB || initialLocalFlag);

  // Sync localStorage flag when user ID becomes available (fixes race where user is null at mount)
  useEffect(() => {
    if (user) {
      const stored = getLocalFlag();
      if (stored) {
        setHasPaymentMethodStripe(true);
        setPaymentCheckDone(true);
      }
    }
  }, [user]);
  const hasPaymentMethod = hasPaymentMethodDB || hasPaymentMethodStripe;

  // Handle return from Stripe onboarding
  useEffect(() => {
    if (stripeReturnHandled) return;
    const stripeSuccess = searchParams.get('stripe_success');
    const hasPendingFlag = localStorage.getItem('flea_stripe_pending') === 'true';
    // Trigger on stripe_success param OR pending flag (covers cases where param is lost)
    if (stripeSuccess !== 'true' && !hasPendingFlag) return;
    if (!user?.email) return;

    setStripeReturnHandled(true);
    // Clean URL params
    searchParams.delete('stripe_success');
    setSearchParams(searchParams, { replace: true });
    localStorage.removeItem('flea_stripe_pending');

    // Verify Stripe status and update profile
    const verifyAndContinue = async () => {
      try {
        const { invokeCloudFunction } = await import('@/utils/cloudFunctions');
        const stripeAccountId = (profile as any)?.stripe_account_id || undefined;
        const { data } = await invokeCloudFunction('stripe-connect-status', {
          stripeAccountId,
        });

        if ((data?.chargesEnabled || data?.detailsSubmitted) && data?.accountId) {
          // Persist connection state in localStorage FIRST (survives remounts)
          if (stripeLocalKey) localStorage.setItem(stripeLocalKey, 'true');
          setHasPaymentMethodStripe(true);

          // Persist to DB
          const { error: dbError } = await supabase
            .from('profiles')
            .update({ stripe_onboarding_complete: true, stripe_account_id: data.accountId } as any)
            .eq('user_id', user.id);

          if (dbError) {
            console.error('Failed to update profile with Stripe status:', dbError);
          }

          await refreshProfile();
          toast.success('Stripe account connected successfully!');

          // Always show shipping setup for new sellers after fresh connect
          // Use refreshed profile or current profile to check
          const currentProfile = profile;
          const needsShipping =
            currentProfile?.tiered_shipping_enabled === null ||
            currentProfile?.tiered_shipping_enabled === undefined ||
            (currentProfile?.tiered_shipping_enabled === true &&
              (currentProfile?.shipping_tier_1 === null || currentProfile?.shipping_tier_1 === undefined));

          if (needsShipping) {
            setShowShippingSetup(true);
            setShippingChecked(true);
          }
        } else {
          toast.error('Stripe onboarding not complete. Please try again.');
        }
      } catch (e) {
        console.error('Stripe verify error:', e);
        toast.error('Failed to verify Stripe connection.');
      }
    };

    verifyAndContinue();
  }, [searchParams, user?.email, stripeReturnHandled, profile, refreshProfile, setSearchParams]);

  // Check Stripe directly for connection status (only if not returning from Stripe)
  useEffect(() => {
    if (hasPaymentMethodDB || hasPaymentMethodStripe) {
      setPaymentCheckDone(true);
      return;
    }
    if (!user?.email || authLoading) return;
    // Skip if we're handling Stripe return
    if (searchParams.get('stripe_success') === 'true') return;
    
    const checkStripe = async () => {
      try {
        const { invokeCloudFunction } = await import('@/utils/cloudFunctions');
        const { data } = await invokeCloudFunction('stripe-connect-status', {
          stripeAccountId: (profile as any)?.stripe_account_id || undefined,
        });
        if (data?.chargesEnabled || data?.detailsSubmitted) {
          setHasPaymentMethodStripe(true);
          if (stripeLocalKey) localStorage.setItem(stripeLocalKey, 'true');
          // Also persist to DB if not already
          if (data.accountId && !hasPaymentMethodDB) {
            await supabase
              .from('profiles')
              .update({ stripe_onboarding_complete: true, stripe_account_id: data.accountId } as any)
              .eq('user_id', user.id);
            await refreshProfile();
          }
        }
      } catch (e) {
        // Silent fail
      } finally {
        setPaymentCheckDone(true);
      }
    };
    
    checkStripe();
  }, [user?.email, hasPaymentMethodDB, hasPaymentMethodStripe, authLoading, searchParams]);

  // Show payment gate only AFTER check completes
  useEffect(() => {
    if (hasPaymentMethodDB) {
      setShowPaymentGate(false);
      return;
    }
    if (!authLoading && user && profile && paymentCheckDone && !hasPaymentMethod) {
      setShowPaymentGate(true);
    } else if (hasPaymentMethod) {
      setShowPaymentGate(false);
    }
  }, [authLoading, user, profile, hasPaymentMethod, paymentCheckDone, hasPaymentMethodDB]);
  
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
    if (!authLoading && user && profile && !shippingChecked && hasPaymentMethod && paymentCheckDone) {
      setShippingChecked(true);

      // Check localStorage first for shipping prefs
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
      const needsShippingSetup =
        profile.shipping_preferences_set !== true &&
        (profile.tiered_shipping_enabled === null ||
        profile.tiered_shipping_enabled === undefined ||
        (profile.tiered_shipping_enabled === true &&
          (profile.shipping_tier_1 === null ||
            profile.shipping_tier_2 === null ||
            profile.shipping_tier_3 === null ||
            profile.shipping_tier_1 === undefined ||
            profile.shipping_tier_2 === undefined ||
            profile.shipping_tier_3 === undefined)));

      if (needsShippingSetup) {
        setShowShippingSetup(true);
      } else {
        // Load tiered shipping settings from profile
        setTieredShippingEnabled(profile.tiered_shipping_enabled ?? false);
        if (profile.tiered_shipping_enabled && profile.shipping_tier_1 != null) {
          setTier1Price(profile.shipping_tier_1);
          setShippingPrice(profile.shipping_tier_1.toString());
        }
      }
    }
  }, [user, profile, authLoading, shippingChecked, hasPaymentMethod, paymentCheckDone]);

  const handleShippingSetupComplete = async () => {
    setShowShippingSetup(false);
    await refreshProfile();
    
    // Reload shipping prefs after setup
    if (user) {
      const localPrefs = loadShippingPrefs(user.id);
      if (localPrefs) {
        setTieredShippingEnabled(localPrefs.tieredEnabled);
        if (localPrefs.tieredEnabled) {
          setTier1Price(localPrefs.tier1);
          setShippingPrice(localPrefs.tier1.toString());
        }
      }
    }
  };

  const handleShippingSetupCancel = () => {
    setShowShippingSetup(false);
    // Navigate back since they can't proceed without setting shipping
    navigate(-1);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remainingSlots = 5 - imageFiles.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    // Compress each image before adding
    for (const file of filesToProcess) {
      try {
        const compressedFile = await compressImage(file, {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 0.8,
        });
        const preview = URL.createObjectURL(compressedFile);
        setImageFiles((prev) => [...prev, { file: compressedFile, preview }]);
      } catch (error) {
        console.error('Failed to compress image:', error);
        // Fallback to original file if compression fails
        const preview = URL.createObjectURL(file);
        setImageFiles((prev) => [...prev, { file, preview }]);
      }
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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
      const { error } = await supabase
        .from('listings')
        .insert({
          user_id: user.id,
          title: productName,
          description: description || null,
          brand,
          size,
          category,
          condition,
          colour: colours.length > 0 ? colours.join(', ') : null,
          style: styles.length > 0 ? styles.join(', ') : null,
          gender: fit || null, // Store fit as gender
          price: parseFloat(itemPrice),
          shipping_price: shippingPrice ? parseFloat(shippingPrice) : 0,
          images: imageUrls,
          tags: [brand, category].filter(Boolean),
          status: 'active',
          region_id: profile?.region_id || null,
          country_code: profile?.country_code || null,
        });
      
      if (error) {
        throw error;
      }
      
      toast.success('Listing posted!');
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
  const selectStyles = "h-14 rounded-2xl bg-muted/50 border border-muted-foreground/20 [&>span]:text-muted-foreground/60 focus:ring-muted-foreground/50";

  // Only show loading while auth is loading (profile not yet available)
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="text-5xl">⏳</span>
      </div>
    );
  }

  // If user has no payment method, show the gate IMMEDIATELY
  // But skip the gate if we're handling a Stripe return (let the verify useEffect run)
  const isStripeReturn = searchParams.get('stripe_success') === 'true' || stripeReturnHandled;
  if (!hasPaymentMethod && user && profile && !isStripeReturn) {
    return (
      <div className="min-h-screen bg-background pb-24">
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
        <ConnectPaymentDialog open={true} onOpenChange={() => {}} />
        <TieredShippingSetupModal
          open={showShippingSetup}
          onComplete={handleShippingSetupComplete}
          onCancel={handleShippingSetupCancel}
        />
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Blocked user banner */}
      {isBlocked && <BlockedUserBanner />}
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
          <div className="flex gap-3 overflow-x-auto pb-2">
            {imageFiles.map((img, index) => (
              <div key={index} className="relative flex-shrink-0">
                <img
                  src={img.preview}
                  alt={`Upload ${index + 1}`}
                  className="h-16 w-16 rounded-lg object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-foreground/80 text-background"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        
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

        {/* Brand - Text Input */}
        <Input
          placeholder="Brand"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className={inputStyles}
        />
        
        {/* Condition */}
        <Select value={condition} onValueChange={setCondition}>
          <SelectTrigger className={`${selectStyles} ${condition ? '[&>span]:text-foreground' : ''}`}>
            <SelectValue placeholder="Condition" />
          </SelectTrigger>
          <SelectContent>
            {CONDITIONS.map((c) => (
              <SelectItem key={c} value={c.toLowerCase()}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

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
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    isSelected ? 'bg-primary text-foreground' : 'bg-muted text-foreground hover:bg-muted/80'
                  }`}
                >
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
        <div className="relative">
          <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-medium ${tieredShippingEnabled ? 'text-muted-foreground/40' : 'text-muted-foreground/60'}`}>$</span>
          <Input
            type="number"
            placeholder="Shipping price"
            value={shippingPrice}
            onChange={(e) => setShippingPrice(e.target.value)}
            disabled={tieredShippingEnabled === true}
            className={`${inputStyles} pl-8 ${tieredShippingEnabled ? 'opacity-60 cursor-not-allowed' : ''}`}
          />
          {tieredShippingEnabled && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60">
              Tiered shipping
            </span>
          )}
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
      
      {/* Payment gate now handled by early return above */}
      
      <BottomNav />
    </div>
  );
};

export default CreateListing;
