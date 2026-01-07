import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import BottomNav from '@/components/BottomNav';
import { toast } from 'sonner';

const categories = [
  'Clothing',
  'Shoes',
  'Accessories',
  'Electronics',
  'Home & Garden',
  'Sports',
  'Books',
  'Other',
];

const conditions = [
  { value: 'new', label: 'New with tags' },
  { value: 'like-new', label: 'Like new' },
  { value: 'good', label: 'Good condition' },
  { value: 'fair', label: 'Fair condition' },
];

const CreateListing = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [condition, setCondition] = useState('');

  const handleImageUpload = () => {
    // Simulate adding a placeholder image
    if (images.length < 5) {
      setImages([...images, `https://picsum.photos/400?random=${Date.now()}`]);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || !description || !price || !category || !condition) {
      toast.error('Please fill in all fields');
      return;
    }
    
    if (images.length === 0) {
      toast.error('Please add at least one image');
      return;
    }
    
    setIsLoading(true);
    
    // Simulate creating listing
    setTimeout(() => {
      setIsLoading(false);
      toast.success('Listing created!');
      navigate('/');
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="flex items-center gap-4 px-4 py-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="h-10 w-10 rounded-full"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold text-foreground">Create Listing</h1>
      </header>
      
      <form onSubmit={handleSubmit} className="px-4 space-y-6">
        {/* Image Upload */}
        <div>
          <Label className="text-base">Photos</Label>
          <p className="text-sm text-muted-foreground mb-3">Add up to 5 photos</p>
          
          <div className="flex gap-3 overflow-x-auto pb-2">
            {images.map((img, index) => (
              <div key={index} className="relative flex-shrink-0">
                <img
                  src={img}
                  alt={`Upload ${index + 1}`}
                  className="h-24 w-24 rounded-xl object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            
            {images.length < 5 && (
              <button
                type="button"
                onClick={handleImageUpload}
                className="flex h-24 w-24 flex-shrink-0 flex-col items-center justify-center rounded-xl border-2 border-dashed border-border hover:border-primary transition-colors"
              >
                <Camera className="h-6 w-6 text-muted-foreground" />
                <span className="mt-1 text-xs text-muted-foreground">Add</span>
              </button>
            )}
          </div>
        </div>
        
        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            placeholder="What are you selling?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-14 rounded-xl"
          />
        </div>
        
        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="Describe your item..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[120px] rounded-xl resize-none"
          />
        </div>
        
        {/* Price */}
        <div className="space-y-2">
          <Label htmlFor="price">Price</Label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              id="price"
              type="number"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="h-14 rounded-xl pl-8"
            />
          </div>
        </div>
        
        {/* Category */}
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-14 rounded-xl">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat.toLowerCase()}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Condition */}
        <div className="space-y-2">
          <Label>Condition</Label>
          <Select value={condition} onValueChange={setCondition}>
            <SelectTrigger className="h-14 rounded-xl">
              <SelectValue placeholder="Select condition" />
            </SelectTrigger>
            <SelectContent>
              {conditions.map((cond) => (
                <SelectItem key={cond.value} value={cond.value}>
                  {cond.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Submit */}
        <Button
          type="submit"
          disabled={isLoading}
          className="h-14 w-full rounded-xl bg-primary text-base font-medium text-primary-foreground hover:bg-mint-dark"
        >
          {isLoading ? 'Publishing...' : 'Publish Listing'}
        </Button>
      </form>
      
      <BottomNav />
    </div>
  );
};

export default CreateListing;
