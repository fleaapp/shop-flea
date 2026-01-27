import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ImagePlus, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import BottomNav from '@/components/BottomNav';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/utils/imageCompression';

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

const EditListing = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMarkingSold, setIsMarkingSold] = useState(false);
  
  // New images to upload
  const [newImageFiles, setNewImageFiles] = useState<ImageFile[]>([]);
  // Existing image URLs from the listing
  const [existingImages, setExistingImages] = useState<string[]>([]);
  
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
      setColour(data.colour || '');
      setStyle(data.style || '');
      setGender(data.gender || '');
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
    
    if (!productName || !size || !brand || !category || !condition || !itemPrice) {
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
          colour: colour || null,
          style: style || null,
          gender: gender || null,
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
      const { error } = await supabase
        .from('listings')
        .delete()
        .eq('id', id);
      
      if (error) {
        throw error;
      }
      
      toast.success('Listing deleted');
      navigate('/profile');
    } catch (error) {
      console.error('Error deleting listing:', error);
      toast.error('Failed to delete listing');
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
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete listing?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete your listing.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
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
      
      <BottomNav />
    </div>
  );
};

export default EditListing;
