import { useState, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera as CapCamera, CameraSource, CameraResultType } from '@capacitor/camera';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Loader2, Play } from 'lucide-react';
import { compressImage } from '@/utils/imageCompression';
import { forceRestoreRouteAppChrome } from '@/lib/appChrome';
import { toast } from 'sonner';

const REFUND_REASONS = [
  'Item not as described',
  'Item damaged during shipping',
  'Wrong item received',
  'Item never arrived',
  'Quality not as expected',
  'Other',
];

const MAX_ITEMS = 5;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024; // 25 MB

type Captured = {
  kind: 'photo' | 'video';
  file: File;
  preview: string;
};

type RefundMediaUpload = {
  fileName: string;
  contentType: string;
  base64: string;
  kind: 'photo' | 'video';
  capture_source: 'live_camera';
};

interface RefundRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  userId: string;
  onSubmit: (data: { reason: string; details: string; imageUploads: RefundMediaUpload[] }) => Promise<void>;
}

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') return reject(new Error('Failed to encode file'));
      const [, base64 = ''] = result.split(',');
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

const isMobileWeb = () => {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
};

const isNative = () => {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
};

const canCaptureLive = () => isNative() || isMobileWeb();

const RefundRequestDialog = ({ open, onOpenChange, orderId, userId, onSubmit }: RefundRequestDialogProps) => {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [items, setItems] = useState<Captured[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const liveCaptureAvailable = canCaptureLive();

  const addItem = (item: Captured) => {
    setItems(prev => (prev.length >= MAX_ITEMS ? prev : [...prev, item]));
  };

  const removeItem = (index: number) => {
    setItems(prev => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].preview);
      next.splice(index, 1);
      return next;
    });
  };

  const handleTakePhoto = async () => {
    if (items.length >= MAX_ITEMS) return;
    setCapturing(true);
    try {
      if (isNative()) {
        // CameraSource.Camera forces the OS camera — gallery is not offered.
        const photo = await CapCamera.getPhoto({
          source: CameraSource.Camera,
          resultType: CameraResultType.Base64,
          quality: 70,
          allowEditing: false,
          saveToGallery: false,
        });
        if (!photo.base64String) throw new Error('No photo captured');
        const byteChars = atob(photo.base64String);
        const bytes = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
        const blob = new Blob([bytes], { type: `image/${photo.format || 'jpeg'}` });
        const file = new File([blob], `refund-photo-${Date.now()}.${photo.format || 'jpg'}`, { type: blob.type });
        addItem({ kind: 'photo', file, preview: URL.createObjectURL(blob) });
      } else {
        photoInputRef.current?.click();
      }
    } catch (err: any) {
      if (err?.message && !/cancel/i.test(err.message)) {
        toast.error(err.message);
      }
    } finally {
      // iOS occasionally reverts StatusBar.overlaysWebView to true after the
      // native camera dismisses, clipping every screen's top row. Re-assert.
      forceRestoreRouteAppChrome();
      setCapturing(false);
    }
  };

  const handleRecordVideo = () => {
    if (items.length >= MAX_ITEMS) return;
    // Both native (WKWebView) and mobile web honor `capture` to force the camera recorder.
    videoInputRef.current?.click();
  };

  const onPhotoFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) addItem({ kind: 'photo', file, preview: URL.createObjectURL(file) });
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const onVideoFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_VIDEO_BYTES) {
      toast.error('Video is too large. Please record a shorter clip (under 25 MB).');
    } else {
      addItem({ kind: 'video', file, preview: URL.createObjectURL(file) });
    }
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!reason) {
      toast.error('Please select a reason for the refund');
      return;
    }
    if (items.length === 0) {
      toast.error('Please add at least one live photo or video as proof');
      return;
    }

    setSubmitting(true);
    try {
      const uploads: RefundMediaUpload[] = [];
      for (const item of items) {
        if (item.kind === 'photo') {
          const compressed = await compressImage(item.file);
          uploads.push({
            fileName: compressed.name,
            contentType: compressed.type || 'image/jpeg',
            base64: await fileToBase64(compressed),
            kind: 'photo',
            capture_source: 'live_camera',
          });
        } else {
          if (item.file.size > MAX_VIDEO_BYTES) {
            throw new Error('Video exceeds 25 MB. Please record a shorter clip.');
          }
          uploads.push({
            fileName: item.file.name || `refund-video-${Date.now()}.mp4`,
            contentType: item.file.type || 'video/mp4',
            base64: await fileToBase64(item.file),
            kind: 'video',
            capture_source: 'live_camera',
          });
        }
      }

      await onSubmit({ reason, details, imageUploads: uploads });

      setReason('');
      setDetails('');
      items.forEach(i => URL.revokeObjectURL(i.preview));
      setItems([]);
      onOpenChange(false);
    } catch (err) {
      console.error('Refund request error:', err);
      const message = err instanceof Error ? err.message : 'Failed to submit refund request';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[85vw] sm:max-w-sm rounded-2xl z-[110]">
        <DialogHeader>
          <DialogTitle className="text-lg">Request Refund</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Reason for refund *</label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent position="popper" className="z-[200] pointer-events-auto">
                {REFUND_REASONS.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Additional details</label>
            <Textarea
              value={details}
              onChange={e => setDetails(e.target.value)}
              placeholder="Provide any additional details..."
              className="rounded-xl resize-none"
              rows={4}
              maxLength={2000}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Live proof *</label>
            <p className="text-xs text-muted-foreground mb-2 leading-snug">
              Photos and videos must be captured live in the app. Uploads from your gallery are not accepted, so we can verify the item and prevent edited or AI generated evidence.
            </p>

            {!liveCaptureAvailable && (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300/60 p-3 text-xs text-amber-800 dark:text-amber-300 mb-2">
                Refund proof must be captured on the Flea mobile app. Please continue this request on your phone.
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {items.map((item, i) => (
                <div key={i} className="relative h-20 w-20 rounded-xl overflow-hidden bg-muted">
                  {item.kind === 'photo' ? (
                    <img src={item.preview} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <>
                      <video src={item.preview} className="h-full w-full object-cover" muted playsInline />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                        <Play className="h-5 w-5 text-white fill-white" />
                      </div>
                    </>
                  )}
                  <button
                    onClick={() => removeItem(i)}
                    className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5"
                    aria-label="Remove"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              ))}
            </div>

            {liveCaptureAvailable && items.length < MAX_ITEMS && (
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={handleTakePhoto}
                  disabled={capturing}
                  className="flex-1 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground disabled:opacity-60"
                >
                  📸 Take photo
                </button>
                <button
                  type="button"
                  onClick={handleRecordVideo}
                  className="flex-1 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground"
                >
                  🎥 Record video
                </button>
              </div>
            )}

            {/* Hidden capture inputs — `capture` forces the OS camera in the webview. */}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onPhotoFilePicked}
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              capture="environment"
              className="hidden"
              onChange={onVideoFilePicked}
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!reason || items.length === 0 || submitting || !liveCaptureAvailable}
            className="w-full rounded-full bg-charcoal text-white hover:bg-charcoal-light h-12"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit Request'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RefundRequestDialog;
