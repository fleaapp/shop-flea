import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ImagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import BottomNav from '@/components/BottomNav';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'One Size'];
const categories = ['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 'Accessories', 'Bags', 'Other'];
const conditions = ['New with tags', 'Like new', 'Good', 'Fair'];
const colours = ['Black', 'White', 'Grey', 'Navy', 'Blue', 'Red', 'Pink', 'Green', 'Brown', 'Beige', 'Multi'];
const styles = ['Casual', 'Formal', 'Streetwear', 'Vintage', 'Sporty', 'Bohemian', 'Minimalist', 'Other'];
const genders = ['Women', 'Men', 'Unisex'];

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
  
  const [productName, setProductName] = useState('');
  const [size, setSize] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [condition, setCondition] = useState('');
  const [colour, setColour] = useState('');
  const [style, setStyle] = useState('');
  const [gender, setGender] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [shippingPrice, setShippingPrice] = useState('');
  const [description, setDescription] = useState('');

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      toast.error('Please sign in to create a listing');
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remainingSlots = 5 - imageFiles.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    filesToProcess.forEach((file) => {
      const preview = URL.createObjectURL(file);
      setImageFiles((prev) => [...prev, { file, preview }]);
    });

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
    
    if (!productName || !size || !brand || !category || !condition || !itemPrice) {
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
          colour: colour || null,
          style: style || null,
          gender: gender || null,
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
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
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
        
        {/* Size */}
        <Select value={size} onValueChange={setSize}>
          <SelectTrigger className={selectStyles}>
            <SelectValue placeholder="Size" />
          </SelectTrigger>
          <SelectContent>
            {sizes.map((s) => (
              <SelectItem key={s} value={s.toLowerCase()}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Brand - Text Input */}
        <Input
          placeholder="Brand"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className={inputStyles}
        />
        
        {/* Category */}
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className={selectStyles}>
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c} value={c.toLowerCase()}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {/* Condition */}
        <Select value={condition} onValueChange={setCondition}>
          <SelectTrigger className={selectStyles}>
            <SelectValue placeholder="Condition" />
          </SelectTrigger>
          <SelectContent>
            {conditions.map((c) => (
              <SelectItem key={c} value={c.toLowerCase()}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Colour */}
        <Select value={colour} onValueChange={setColour}>
          <SelectTrigger className={selectStyles}>
            <SelectValue placeholder="Colour" />
          </SelectTrigger>
          <SelectContent>
            {colours.map((c) => (
              <SelectItem key={c} value={c.toLowerCase()}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Style */}
        <Select value={style} onValueChange={setStyle}>
          <SelectTrigger className={selectStyles}>
            <SelectValue placeholder="Style" />
          </SelectTrigger>
          <SelectContent>
            {styles.map((s) => (
              <SelectItem key={s} value={s.toLowerCase()}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Gender */}
        <Select value={gender} onValueChange={setGender}>
          <SelectTrigger className={selectStyles}>
            <SelectValue placeholder="Gender" />
          </SelectTrigger>
          <SelectContent>
            {genders.map((g) => (
              <SelectItem key={g} value={g.toLowerCase()}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
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
      
      <BottomNav />
    </div>
  );
};

export default CreateListing;
