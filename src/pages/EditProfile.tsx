import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Camera } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/utils/imageCompression';
import { getDefaultAvatar } from '@/utils/defaultAvatars';
import AvatarCropDialog from '@/components/AvatarCropDialog';
import ChangeEmailSheet from '@/components/ChangeEmailSheet';
import ChangePasswordSheet from '@/components/ChangePasswordSheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const EditProfile = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, profile, refreshProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState(''); // Without @ prefix
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [canDeleteAccount, setCanDeleteAccount] = useState(true);
  const [deleteBlockReason, setDeleteBlockReason] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [originalUsername, setOriginalUsername] = useState('');
  const [emailSheetOpen, setEmailSheetOpen] = useState(false);
  const [passwordSheetOpen, setPasswordSheetOpen] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

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
        setCountryCode(data.country_code || null);
      }

      // Check for account deletion eligibility
      // Must wait 14 days after all sold items are delivered
      const { data: recentOrders } = await supabase
        .from('orders')
        .select('delivered_at, status')
        .eq('seller_id', user.id)
        .eq('status', 'delivered')
        .order('delivered_at', { ascending: false })
        .limit(1);

      if (recentOrders && recentOrders.length > 0) {
        const lastDelivery = new Date(recentOrders[0].delivered_at);
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
        
        if (lastDelivery > fourteenDaysAgo) {
          setCanDeleteAccount(false);
          const daysRemaining = Math.ceil((lastDelivery.getTime() - fourteenDaysAgo.getTime()) / (1000 * 60 * 60 * 24));
          setDeleteBlockReason(`Wait ${daysRemaining} days after last delivery`);
        }
      }

      // Also check for outstanding orders (not delivered yet)
      const { count: outstandingCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .not('status', 'eq', 'delivered');
      
      if ((outstandingCount || 0) > 0) {
        setCanDeleteAccount(false);
        setDeleteBlockReason('Complete all orders first');
      }
    };
    
    loadProfile();
  }, [user]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCroppedAvatar = async (blob: Blob) => {
    setCropSrc(null);
    if (!user) return;
    setUploading(true);
    try {
      const compressedFile = await compressImage(
        new File([blob], 'avatar.jpg', { type: 'image/jpeg' }),
        { maxWidth: 400, maxHeight: 400, quality: 0.85 }
      );
      const filePath = `${user.id}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage.from('listings').upload(filePath, compressedFile, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('listings').getPublicUrl(filePath);
      setAvatarUrl(`${publicUrl}?t=${Date.now()}`);
      queryClient.invalidateQueries({ queryKey: ['profile-avatar'] });
      toast.success('Avatar uploaded');
    } catch {
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
    if (!canDeleteAccount) {
      toast.error(deleteBlockReason || 'Cannot delete account');
      return;
    }
    
    // In a real app, this would trigger account deletion
    toast.error('Account deletion requires confirmation via email');
  };

  // Helper to get country name from code
  const getCountryName = (code: string): string => {
    const countryNames: Record<string, string> = {
      AU: 'Australia',
      NZ: 'New Zealand',
      GB: 'United Kingdom',
      US: 'United States',
      CA: 'Canada',
      AT: 'Austria', BE: 'Belgium', BG: 'Bulgaria', HR: 'Croatia', CY: 'Cyprus',
      CZ: 'Czech Republic', DK: 'Denmark', EE: 'Estonia', FI: 'Finland', FR: 'France',
      DE: 'Germany', GR: 'Greece', HU: 'Hungary', IE: 'Ireland', IT: 'Italy',
      LV: 'Latvia', LT: 'Lithuania', LU: 'Luxembourg', MT: 'Malta', NL: 'Netherlands',
      PL: 'Poland', PT: 'Portugal', RO: 'Romania', SK: 'Slovakia', SI: 'Slovenia',
      ES: 'Spain', SE: 'Sweden',
    };
    return countryNames[code] || code;
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
                src={avatarUrl || getDefaultAvatar(user?.id || 'default')} 
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
            <Label className="text-sm font-medium text-foreground mb-2 block">Location</Label>
            <button 
              onClick={() => setLocationDialogOpen(true)}
              className="flex w-full items-center justify-between h-12 rounded-2xl bg-muted px-4 card-shadow cursor-pointer"
            >
              <span className="text-muted-foreground">
                {countryCode ? getCountryName(countryCode) : 'Not set'}
              </span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">Email</Label>
            <button 
              onClick={() => setEmailSheetOpen(true)}
              className="flex w-full items-center justify-between h-12 rounded-2xl bg-card px-4 card-shadow"
            >
              <span className="text-muted-foreground">{user?.email || 'Email'}</span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">Password</Label>
            <button 
              onClick={() => setPasswordSheetOpen(true)}
              className="flex w-full items-center justify-between h-12 rounded-2xl bg-card px-4 card-shadow"
            >
              <span className="text-muted-foreground">••••••••••</span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Buttons - shorter width */}
        <div className="flex flex-col items-center gap-3 pt-4">
          <Button 
            onClick={handleSave}
            disabled={isLoading}
            className="w-48 h-12 rounded-full bg-primary text-primary-foreground font-medium"
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>

          <Button
            variant="ghost"
            onClick={handleDeleteAccount}
            disabled={!canDeleteAccount}
            className={`w-48 h-12 rounded-full font-medium ${
              !canDeleteAccount 
                ? 'bg-muted text-muted-foreground cursor-not-allowed' 
                : 'bg-muted text-destructive hover:bg-destructive/10'
            }`}
          >
            Delete account
          </Button>
          
          {!canDeleteAccount && deleteBlockReason && (
            <p className="text-center text-xs text-muted-foreground">
              {deleteBlockReason}
            </p>
          )}
        </div>
       
       {/* Change Email Sheet */}
       <ChangeEmailSheet
         open={emailSheetOpen}
         onOpenChange={setEmailSheetOpen}
         currentEmail={user?.email || ''}
       />
       
        {/* Change Password Sheet */}
        <ChangePasswordSheet
          open={passwordSheetOpen}
          onOpenChange={setPasswordSheetOpen}
        />
        
        {/* Location Change Dialog */}
        <AlertDialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
          <AlertDialogContent className="max-w-[300px] rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Change Location</AlertDialogTitle>
              <AlertDialogDescription className="text-center">
                If you need to change your location, please reach out to support for assistance.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction className="w-full">OK</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {cropSrc && (
          <AvatarCropDialog
            open={!!cropSrc}
            imageSrc={cropSrc}
            onCancel={() => setCropSrc(null)}
            onCropComplete={handleCroppedAvatar}
          />
        )}
      </div>
    </div>
  );
};

export default EditProfile;
