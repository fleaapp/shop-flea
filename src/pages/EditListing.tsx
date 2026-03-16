import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ImagePlus, X, Trash2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import BottomNav from '@/components/BottomNav';
import SizeSelectionDrawer from '@/components/SizeSelectionDrawer';
import CategorySelectionDrawer from '@/components/CategorySelectionDrawer';
import BlockedUserBanner from '@/components/BlockedUserBanner';
import ShippingSettingsSheet from '@/components/ShippingSettingsSheet';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { loadShippingPrefs } from '@/utils/shippingPrefs';
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/utils/imageCompression';
import { useContentModeration } from '@/hooks/useContentModeration';
import { useBlockedStatus } from '@/hooks/useBlockedStatus';
import {
  FIT_OPTIONS,
  CATEGORY_OPTIONS,
  CONDITIONS,
  COLOURS,
  STYLES,
  isShoeCategory,
} from '@/config/sizeConfig';
import { COLOUR_SWATCHES } from '@/utils/colourSwatches';
import ConditionInfoPopover from '@/components/ConditionInfoPopover';

interface ImageFile {
  file: File;
  preview: string;
}

const EditListing = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const { checkListingContent, isChecking } = useContentModeration();
  const { isBlocked } = useBlockedStatus();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMarkingSold, setIsMarkingSold] = useState(false);
  const [sizeDrawerOpen, setSizeDrawerOpen] = useState(false);
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [showShippingSettings, setShowShippingSettings] = useState(false);
  
  // Tiered shipping state
  const [tieredShippingEnabled, setTieredShippingEnabled] = useState<boolean | null>(null);
  
  // New images to upload
  const [newImageFiles, setNewImageFiles] = useState<ImageFile[]>([]);
  // Existing image URLs from the listing
  const [existingImages, setExistingImages] = useState<string[]>([]);
  
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

  // Fetch existing listing data
  useEffect(() => {
    const fetchListing = async () => {
      if (!id) return;
      
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error || !data) {
        toast.error('Listing not found');
        navigate('/profile');
        return;
      }
      
      // Check if user owns this listing
      if (data.user_id !== user?.id) {
        toast.error('You can only edit your own listings');
        navigate('/profile');
        return;
      }
      
      setProductName(data.title);
      setSize(data.size);
      setBrand(data.brand);
      setCategory(data.category);
      setCondition(data.condition);
      // Parse comma-separated colours/styles back into arrays
      setColours(data.colour ? data.colour.split(', ').map((c: string) => c.toLowerCase()) : []);
      setStyles(data.style ? data.style.split(', ').map((s: string) => s.toLowerCase()) : []);
      setFit(data.gender || '');
      setItemPrice(data.price.toString());
      setShippingPrice(data.shipping_price?.toString() || '');
      setDescription(data.description || '');
      setExistingImages(data.images || []);
      setIsFetching(false);
    };
    
    if (!authLoading && user) {
      fetchListing();
    }
  }, [id, user, authLoading, navigate]);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      toast.error('Please sign in to edit a listing');
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Load tiered shipping settings
  useEffect(() => {
    if (!authLoading && user && profile) {
      // Check localStorage first for shipping prefs
      const localPrefs = loadShippingPrefs(user.id);
      if (localPrefs) {
        setTieredShippingEnabled(localPrefs.tieredEnabled);
        if (localPrefs.tieredEnabled) {
          setShippingPrice(localPrefs.tier1.toString());
        }
        return;
      }

      // Fall back to profile data
      setTieredShippingEnabled(profile.tiered_shipping_enabled ?? false);
      if (profile.tiered_shipping_enabled && profile.shipping_tier_1 != null) {
        setShippingPrice(profile.shipping_tier_1.toString());
      }
    }
  }, [user, profile, authLoading]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const totalImages = existingImages.length + newImageFiles.length;
    const remainingSlots = 5 - totalImages;
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
        setNewImageFiles((prev) => [...prev, { file: compressedFile, preview }]);
      } catch (error) {
        console.error('Failed to compress image:', error);
        // Fallback to original file if compression fails
        const preview = URL.createObjectURL(file);
        setNewImageFiles((prev) => [...prev, { file, preview }]);
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const removeExistingImage = (index: number) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeNewImage = (index: number) => {
    setNewImageFiles((prev) => {
      const removed = prev[index];
      URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadImages = async (): Promise<string[]> => {
    if (!user) return [];
    
    const uploadedUrls: string[] = [];
    
    for (const imageFile of newImageFiles) {
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
    
    if (!user || !id) {
      toast.error('Please sign in to edit a listing');
      navigate('/auth');
      return;
    }

    if (isBlocked) {
      toast.error('Your account is restricted. You cannot edit listings.');
      return;
    }
    
    if (!productName || !fit || !category || !size || !brand || !condition || !itemPrice) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    const totalImages = existingImages.length + newImageFiles.length;
    if (totalImages === 0) {
      toast.error('Please add at least one image');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Check content moderation before saving
      const moderationResult = await checkListingContent({
        title: productName,
        description: description || undefined,
        brand,
      });

      if (moderationResult.isBlocked) {
        setIsLoading(false);
        return;
      }

      // Upload new images
      const newImageUrls = await uploadImages();
      const allImages = [...existingImages, ...newImageUrls];
      
      // Update the listing
      const { error } = await supabase
        .from('listings')
        .update({
          title: productName,
          description: description || null,
          brand,
          size,
          category,
          condition,
          colour: colours.length > 0 ? colours.join(', ') : null,
          style: styles.length > 0 ? styles.join(', ') : null,
          gender: fit || null,
          price: parseFloat(itemPrice),
          shipping_price: shippingPrice ? parseFloat(shippingPrice) : 0,
          images: allImages,
          tags: [brand, category].filter(Boolean),
        })
        .eq('id', id);
      
      if (error) {
        throw error;
      }
      
      toast.success('Listing updated!');
      navigate('/profile');
    } catch (error) {
      console.error('Error updating listing:', error);
      toast.error('Failed to update listing. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    setIsDeleting(true);

    try {
      const { error: removeError } = await supabase
        .from('listings')
        .update({ status: 'removed' })
        .eq('id', id);

      // Some environments still enforce older status checks; fallback to archived.
      if (removeError?.code === '23514') {
        const { error: archiveError } = await supabase
          .from('listings')
          .update({ status: 'archived' })
          .eq('id', id);

        if (archiveError) throw archiveError;
      } else if (removeError) {
        throw removeError;
      }

      toast.success('Listing removed');
      navigate('/profile');
    } catch (error) {
      console.error('Error removing listing:', error);
      toast.error('Failed to remove listing');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMarkAsSold = async () => {
    if (!id) return;
    
    setIsMarkingSold(true);
    
    try {
      const { error } = await supabase
        .from('listings')
        .update({ status: 'sold' })
        .eq('id', id);
      
      if (error) {
        throw error;
      }
      
      toast.success('Listing marked as sold');
      navigate('/profile');
    } catch (error) {
      console.error('Error marking listing as sold:', error);
      toast.error('Failed to mark listing as sold');
    } finally {
      setIsMarkingSold(false);
    }
  };

  const inputStyles = "h-14 rounded-2xl bg-muted/50 border border-muted-foreground/20 placeholder:text-muted-foreground/60 focus-visible:ring-muted-foreground/50";
  const selectStyles = "h-14 rounded-2xl bg-muted/50 border border-muted-foreground/20 [&>span]:text-muted-foreground/60 focus:ring-muted-foreground/50";

  const totalImages = existingImages.length + newImageFiles.length;

  if (authLoading || isFetching) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="text-5xl">⏳</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
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
        <h1 className="text-xl font-bold text-foreground">Edit Listing</h1>
      </header>
      
      <form onSubmit={handleSubmit} className="px-4 space-y-4">
        {/* Photo Upload Area */}
        <button
          type="button"
          onClick={triggerFileInput}
          className="w-full h-32 rounded-2xl bg-muted/50 border border-muted-foreground/20 flex flex-col items-center justify-center gap-2"
        >
          <ImagePlus className="h-8 w-8 text-muted-foreground/60" />
          <span className="text-sm text-muted-foreground/60">Add photos ({totalImages}/5)</span>
        </button>

        {/* Image Thumbnails */}
        {totalImages > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {/* Existing images */}
            {existingImages.map((url, index) => (
              <div key={`existing-${index}`} className="relative flex-shrink-0">
                <img
                  src={url}
                  alt={`Image ${index + 1}`}
                  className="h-16 w-16 rounded-lg object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeExistingImage(index)}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-foreground/80 text-background"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {/* New images */}
            {newImageFiles.map((img, index) => (
              <div key={`new-${index}`} className="relative flex-shrink-0">
                <img
                  src={img.preview}
                  alt={`New upload ${index + 1}`}
                  className="h-16 w-16 rounded-lg object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeNewImage(index)}
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
          className={`${selectStyles} w-full flex items-center justify-between px-4 text-left ${
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
        <div className="flex items-center gap-2">
          <ConditionInfoPopover />
          <Select value={condition} onValueChange={setCondition}>
            <SelectTrigger className={`${selectStyles} flex-1 max-w-[200px] ${condition ? '[&>span]:text-foreground' : ''}`}>
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
            className={`${inputStyles} pl-8 ${tieredShippingEnabled ? 'opacity-60 cursor-pointer' : ''}`}
            style={tieredShippingEnabled ? { pointerEvents: 'none' } : undefined}
          />
          {tieredShippingEnabled && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60">
              Tiered shipping ›
            </span>
          )}
        </div>
        
        {/* Description */}
        <Textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="min-h-[120px] rounded-2xl bg-muted/50 border border-muted-foreground/20 resize-none placeholder:text-muted-foreground/60 focus-visible:ring-muted-foreground/50"
          style={{ textTransform: 'none' }}
        />
        
        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3 pt-4 pb-8">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={isDeleting}
                className="h-12 w-12 rounded-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-[280px] rounded-2xl p-5">
              <AlertDialogHeader className="space-y-2">
                <AlertDialogTitle className="text-base text-center">Remove listing?</AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-center leading-relaxed">
                  This will hide your listing&nbsp;and<br />mark it as removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-row gap-2 sm:flex-row">
                <AlertDialogCancel className="flex-1 mt-0 h-9 rounded-lg text-sm">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="flex-1 h-9 rounded-lg text-sm bg-destructive text-white hover:bg-destructive/90"
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          
          <Button
            type="button"
            onClick={handleMarkAsSold}
            disabled={isMarkingSold}
            className="h-12 px-6 rounded-full font-medium"
            style={{ backgroundColor: '#29303d', color: '#ddfed7' }}
          >
            {isMarkingSold ? 'Marking...' : 'Mark as sold'}
          </Button>
          
          <Button
            type="submit"
            disabled={isLoading}
            className="h-12 px-6 rounded-full font-medium"
            style={{ backgroundColor: '#ddfed7', color: '#29303d' }}
          >
            {isLoading ? 'Updating...' : 'Update'}
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

      <ShippingSettingsSheet
        open={showShippingSettings}
        onOpenChange={(open) => {
          setShowShippingSettings(open);
          if (!open && user) {
            const localPrefs = loadShippingPrefs(user.id);
            if (localPrefs && localPrefs.tieredEnabled) {
              setShippingPrice(localPrefs.tier1.toString());
            }
          }
        }}
      />
      
      <BottomNav />
    </div>
  );
};

export default EditListing;
