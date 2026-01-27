import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Camera } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/utils/imageCompression';

const SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'One Size'];
const GENDERS = ['Men', 'Women', 'Unisex'];

const EditProfile = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState(''); // Without @ prefix
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [pauseSelling, setPauseSelling] = useState(false);
  const [preferredSizes, setPreferredSizes] = useState<string[]>([]);
  const [preferredGender, setPreferredGender] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [hasOutstandingOrders, setHasOutstandingOrders] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [originalUsername, setOriginalUsername] = useState('');

  // Load profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (data) {
        // Remove @ prefix for editing
        const cleanUsername = (data.username || '').replace(/^@/, '');
        setUsername(cleanUsername);
        setOriginalUsername(cleanUsername);
        setAvatarUrl(data.avatar_url);
        // Cast to access new columns that TypeScript doesn't know about yet
        const profileData = data as any;
        setFirstName(profileData.first_name || '');
        setLastName(profileData.last_name || '');
        setPauseSelling(profileData.pause_selling || false);
        setPreferredSizes(profileData.preferred_sizes || []);
        setPreferredGender(profileData.preferred_gender || null);
      }

      // Check for outstanding orders
      const { count } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .not('status', 'eq', 'delivered');
      
      setHasOutstandingOrders((count || 0) > 0);
    };
    
    loadProfile();
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      // Compress avatar image - smaller for profile pics
      const compressedFile = await compressImage(file, {
        maxWidth: 400,
        maxHeight: 400,
        quality: 0.85,
      });
      
      const filePath = `${user.id}/avatar.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('listings')
        .upload(filePath, compressedFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('listings')
        .getPublicUrl(filePath);

      // Add cache buster to force refresh
      setAvatarUrl(`${publicUrl}?t=${Date.now()}`);
      toast.success('Avatar uploaded');
    } catch (error) {
      toast.error('Failed to upload avatar');
    } finally {
      setUploading(false);
    }
  };

  const checkUsernameAvailability = async (newUsername: string): Promise<boolean> => {
    if (!newUsername.trim()) {
      setUsernameError('Username is required');
      return false;
    }
    
    // If username hasn't changed, it's valid
    if (newUsername === originalUsername) {
      setUsernameError(null);
      return true;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', `@${newUsername}`)
      .maybeSingle();

    if (error) {
      setUsernameError('Error checking username');
      return false;
    }

    if (data) {
      setUsernameError('Username is already taken');
      return false;
    }

    setUsernameError(null);
    return true;
  };

  const handleSave = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Check username availability
      const isAvailable = await checkUsernameAvailability(username);
      if (!isAvailable) {
        setIsLoading(false);
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          username: `@${username}`,
          avatar_url: avatarUrl,
          first_name: firstName,
          last_name: lastName,
          pause_selling: pauseSelling,
          preferred_sizes: preferredSizes,
          preferred_gender: preferredGender,
        } as any)
        .eq('user_id', user.id);

      if (error) throw error;
      
      // Refresh the profile in AuthContext so other screens update
      await refreshProfile();
      
      toast.success('Profile updated');
      navigate('/settings');
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (hasOutstandingOrders) {
      toast.error('Cannot delete account with outstanding orders');
      return;
    }
    
    // In a real app, this would trigger account deletion
    toast.error('Account deletion requires confirmation via email');
  };

  const toggleSize = (size: string) => {
    setPreferredSizes(prev => 
      prev.includes(size) 
        ? prev.filter(s => s !== size)
        : [...prev, size]
    );
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background px-4 py-4">
        <div className="flex items-center">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="h-6 w-6 text-foreground" />
          </button>
          <h1 className="flex-1 text-center text-lg font-bold text-foreground pr-8">Edit Profile</h1>
        </div>
      </header>

      <div className="px-6 space-y-6">
        {/* Avatar */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="h-28 w-28 rounded-full p-0.5 bg-gradient-to-br from-muted to-border">
              <img 
                src={avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id}`} 
                alt="Profile" 
                className="h-full w-full rounded-full bg-card object-cover" 
              />
            </div>
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-md"
            >
              <Camera className="h-5 w-5 text-muted-foreground" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* Pause Selling Toggle */}
        <div className="flex items-center justify-between rounded-2xl bg-card p-4 card-shadow">
          <span className="font-medium text-foreground">Pause selling</span>
          <Switch 
            checked={pauseSelling} 
            onCheckedChange={setPauseSelling} 
          />
        </div>

        {/* Preferences */}
        <button 
          onClick={() => setPreferencesOpen(true)}
          className="flex w-full items-center justify-between rounded-2xl bg-card p-4 card-shadow"
        >
          <span className="font-medium text-foreground">Preferences</span>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </button>

        {/* Form Fields */}
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">First name</Label>
            <Input
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="h-12 rounded-2xl bg-card border-0 card-shadow"
            />
          </div>

          <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">Last name</Label>
            <Input
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="h-12 rounded-2xl bg-card border-0 card-shadow"
            />
          </div>

          <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">Username</Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground font-medium">@</span>
              <Input
                placeholder="username"
                value={username}
                onChange={(e) => {
                  // Remove any @ symbols the user might type
                  const value = e.target.value.replace(/@/g, '');
                  setUsername(value);
                  setUsernameError(null);
                }}
                onBlur={() => {
                  if (username && username !== originalUsername) {
                    checkUsernameAvailability(username);
                  }
                }}
                className="h-12 rounded-2xl bg-card border-0 card-shadow pl-8"
              />
            </div>
            {usernameError && (
              <p className="text-xs text-destructive mt-1">{usernameError}</p>
            )}
          </div>

          <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">Email</Label>
            <button 
              onClick={() => toast.info('Email change requires verification')}
              className="flex w-full items-center justify-between h-12 rounded-2xl bg-card px-4 card-shadow"
            >
              <span className="text-muted-foreground">{user?.email || 'Email'}</span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">Password</Label>
            <button 
              onClick={() => toast.info('Password change coming soon')}
              className="flex w-full items-center justify-between h-12 rounded-2xl bg-card px-4 card-shadow"
            >
              <span className="text-muted-foreground">••••••••••</span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Save Button */}
        <Button 
          onClick={handleSave}
          disabled={isLoading}
          className="w-full h-12 rounded-full bg-primary text-primary-foreground font-medium"
        >
          {isLoading ? 'Saving...' : 'Save Changes'}
        </Button>

        {/* Delete Account */}
        <Button
          variant="ghost"
          onClick={handleDeleteAccount}
          disabled={hasOutstandingOrders}
          className={`w-full h-12 rounded-full font-medium ${
            hasOutstandingOrders 
              ? 'bg-muted text-muted-foreground cursor-not-allowed' 
              : 'bg-muted text-destructive hover:bg-destructive/10'
          }`}
        >
          Delete account
        </Button>
        
        {hasOutstandingOrders && (
          <p className="text-center text-xs text-muted-foreground">
            Complete all orders before deleting your account
          </p>
        )}
      </div>

      {/* Preferences Sheet */}
      <Sheet open={preferencesOpen} onOpenChange={setPreferencesOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="text-center">Filter Preferences</SheetTitle>
          </SheetHeader>
          
          <div className="mt-6 space-y-6 pb-8">
            {/* Size Preferences */}
            <div>
              <Label className="text-sm font-medium text-foreground mb-3 block">Preferred Sizes</Label>
              <div className="flex flex-wrap gap-2">
                {SIZES.map((size) => (
                  <button
                    key={size}
                    onClick={() => toggleSize(size)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      preferredSizes.includes(size)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Gender Preferences */}
            <div>
              <Label className="text-sm font-medium text-foreground mb-3 block">Preferred Gender</Label>
              <div className="flex flex-wrap gap-2">
                {GENDERS.map((gender) => (
                  <button
                    key={gender}
                    onClick={() => setPreferredGender(preferredGender === gender ? null : gender)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      preferredGender === gender
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {gender}
                  </button>
                ))}
              </div>
            </div>

            <Button 
              onClick={() => setPreferencesOpen(false)}
              className="w-full h-12 rounded-full bg-primary text-primary-foreground font-medium"
            >
              Done
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default EditProfile;