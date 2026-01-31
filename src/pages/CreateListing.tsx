import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ImagePlus, X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import BottomNav from '@/components/BottomNav';
import SizeSelectionDrawer from '@/components/SizeSelectionDrawer';
import CategorySelectionDrawer from '@/components/CategorySelectionDrawer';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/utils/imageCompression';
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
  const { user, loading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [imageFiles, setImageFiles] = useState<ImageFile[]>([]);
  const [sizeDrawerOpen, setSizeDrawerOpen] = useState(false);
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  
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
      // Upload images to storage
      const imageUrls = await uploadImages();
      
      // Create the listing
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
        });
      
      if (error) {
        throw error;
      }
      
      toast.success('Listing posted!');
      navigate('/profile');
    } catch (error) {
      console.error('Error creating listing:', error);
      toast.error('Failed to create listing. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyles = "h-14 rounded-2xl bg-muted/50 border border-muted-foreground/20 placeholder:text-muted-foreground/60 focus-visible:ring-muted-foreground/50";
  const selectStyles = "h-14 rounded-2xl bg-muted/50 border border-muted-foreground/20 [&>span]:text-muted-foreground/60 focus:ring-muted-foreground/50";

  if (authLoading) {
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
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 font-medium">$</span>
          <Input
            type="number"
            placeholder="Shipping price"
            value={shippingPrice}
            onChange={(e) => setShippingPrice(e.target.value)}
            className={`${inputStyles} pl-8`}
          />
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
      
      <BottomNav />
    </div>
  );
};

export default CreateListing;
