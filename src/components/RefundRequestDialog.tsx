import { useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera as CapCamera, CameraSource, CameraResultType } from '@capacitor/camera';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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

export type RefundItemOption = {
  orderId: string;
  title: string;
  image: string;
  price: number;
  shipping: number;
  alreadyRequested?: boolean;
};

export type RefundSelection = {
  orderId: string;
  reason: string;
  note: string;
};

interface RefundRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: RefundItemOption[];
  onSubmit: (data: {
    selections: RefundSelection[];
    details: string;
    imageUploads: RefundMediaUpload[];
  }) => Promise<void>;
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

const RefundRequestDialog = ({ open, onOpenChange, items, onSubmit }: RefundRequestDialogProps) => {
  const eligibleItems = useMemo(() => items.filter((i) => !i.alreadyRequested), [items]);
  const multi = items.length > 1;

  const [step, setStep] = useState<1 | 2>(multi ? 1 : 2);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    if (multi) return new Set();
    return new Set(eligibleItems.map((i) => i.orderId));
  });
  const [reasonMap, setReasonMap] = useState<Record<string, string>>({});
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const [details, setDetails] = useState('');
  const [media, setMedia] = useState<Captured[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const liveCaptureAvailable = canCaptureLive();

  // Reset state when the dialog is (re)opened.
  useEffect(() => {
    if (!open) return;
    setStep(multi ? 1 : 2);
    setSelectedIds(multi ? new Set() : new Set(eligibleItems.map((i) => i.orderId)));
    setReasonMap({});
    setNoteMap({});
    setDetails('');
    setMedia([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggleSelect = (orderId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const selectedList = eligibleItems.filter((i) => selectedIds.has(i.orderId));
  const allSelectedHaveReason = selectedList.length > 0 && selectedList.every((i) => !!reasonMap[i.orderId]);

  const addMedia = (item: Captured) => {
    setMedia((prev) => (prev.length >= MAX_ITEMS ? prev : [...prev, item]));
  };

  const removeMedia = (index: number) => {
    setMedia((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].preview);
      next.splice(index, 1);
      return next;
    });
  };

  const handleTakePhoto = async () => {
    if (media.length >= MAX_ITEMS) return;
    setCapturing(true);
    try {
      if (isNative()) {
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
        addMedia({ kind: 'photo', file, preview: URL.createObjectURL(blob) });
      } else {
        photoInputRef.current?.click();
      }
    } catch (err: any) {
      if (err?.message && !/cancel/i.test(err.message)) toast.error(err.message);
    } finally {
      forceRestoreRouteAppChrome();
      setCapturing(false);
    }
  };

  const handleRecordVideo = () => {
    if (media.length >= MAX_ITEMS) return;
    videoInputRef.current?.click();
  };

  const onPhotoFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) addMedia({ kind: 'photo', file, preview: URL.createObjectURL(file) });
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const onVideoFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_VIDEO_BYTES) {
      toast.error('Video is too large. Please record a shorter clip (under 25 MB).');
    } else {
      addMedia({ kind: 'video', file, preview: URL.createObjectURL(file) });
    }
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (selectedList.length === 0) {
      toast.error('Please select at least one item to refund');
      return;
    }
    if (!allSelectedHaveReason) {
      toast.error('Please choose a reason for every selected item');
      return;
    }
    if (media.length === 0) {
      toast.error('Please add at least one live photo or video as proof');
      return;
    }

    setSubmitting(true);
    try {
      const uploads: RefundMediaUpload[] = [];
      for (const item of media) {
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

      const selections: RefundSelection[] = selectedList.map((i) => ({
        orderId: i.orderId,
        reason: reasonMap[i.orderId],
        note: (noteMap[i.orderId] || '').trim(),
      }));

      await onSubmit({ selections, details: details.trim(), imageUploads: uploads });

      media.forEach((m) => URL.revokeObjectURL(m.preview));
      onOpenChange(false);
    } catch (err) {
      console.error('Refund request error:', err);
      const message = err instanceof Error ? err.message : 'Failed to submit refund request';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const canContinueFromStep1 = selectedList.length > 0 && allSelectedHaveReason;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[85vw] sm:max-w-sm rounded-2xl z-[110] max-h-[85svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Request Refund</DialogTitle>
          {multi && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Step {step} of 2 • {step === 1 ? 'Select items' : 'Add proof'}
            </p>
          )}
        </DialogHeader>

        {step === 1 && multi && (
          <div className="space-y-3 mt-2">
            <p className="text-xs text-muted-foreground leading-snug">
              Choose the items you want to refund and pick a reason for each.
            </p>
            <p className="text-xs text-muted-foreground leading-snug">
              Parcel marked delivered but nothing arrived? Check with your neighbours and your local post office first, then choose "Item never arrived" - we'll review it with the seller.
            </p>


            <div className="space-y-2">
              {items.map((it) => {
                const disabled = !!it.alreadyRequested;
                const checked = selectedIds.has(it.orderId);
                return (
                  <div
                    key={it.orderId}
                    className={`rounded-xl border p-3 ${disabled ? 'opacity-60' : ''} ${checked ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}
                  >
                    <div className="flex gap-3 items-start">
                      <Checkbox
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={() => !disabled && toggleSelect(it.orderId)}
                        className="mt-1"
                      />
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => !disabled && toggleSelect(it.orderId)}
                        className="flex-1 flex gap-3 text-left"
                      >
                        <img
                          src={it.image}
                          alt=""
                          className="h-14 w-14 rounded-lg object-cover bg-muted shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">{it.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            ${it.price.toFixed(2)}
                            {it.shipping > 0 ? ` + $${it.shipping.toFixed(2)} shipping` : ''}
                          </p>
                          {disabled && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">Refund already requested</p>
                          )}
                        </div>
                      </button>
                    </div>

                    {checked && !disabled && (
                      <div className="mt-3 space-y-2 pl-7">
                        <Select
                          value={reasonMap[it.orderId] || ''}
                          onValueChange={(v) => setReasonMap((prev) => ({ ...prev, [it.orderId]: v }))}
                        >
                          <SelectTrigger className="h-9 rounded-lg text-xs">
                            <SelectValue placeholder="Select a reason" />
                          </SelectTrigger>
                          <SelectContent position="popper" className="z-[200] pointer-events-auto">
                            {REFUND_REASONS.map((r) => (
                              <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={noteMap[it.orderId] || ''}
                          onChange={(e) => setNoteMap((prev) => ({ ...prev, [it.orderId]: e.target.value }))}
                          placeholder="Add a note (optional)"
                          maxLength={200}
                          className="h-9 rounded-lg text-xs"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <Button
              onClick={() => setStep(2)}
              disabled={!canContinueFromStep1}
              className="w-full rounded-full bg-charcoal text-white hover:bg-charcoal-light h-12"
            >
              Continue
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 mt-2">
            {!multi && eligibleItems[0] && (
              <div className="rounded-xl bg-card border border-border p-3">
                <div className="flex gap-3 items-center">
                  <img
                    src={eligibleItems[0].image}
                    alt=""
                    className="h-12 w-12 rounded-lg object-cover bg-muted shrink-0"
                  />
                  <p className="text-sm font-semibold truncate">{eligibleItems[0].title}</p>
                </div>
                <div className="mt-3 space-y-2">
                  <label className="text-xs font-medium text-foreground block">Reason for refund *</label>
                  <Select
                    value={reasonMap[eligibleItems[0].orderId] || ''}
                    onValueChange={(v) => setReasonMap((prev) => ({ ...prev, [eligibleItems[0].orderId]: v }))}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Select a reason" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="z-[200] pointer-events-auto">
                      {REFUND_REASONS.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {reasonMap[eligibleItems[0].orderId] === 'Item never arrived' && (
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Check with your neighbours and your local post office first. If it's still missing, we'll review it with the seller.
                    </p>
                  )}
                </div>
              </div>
            )}


            {multi && (
              <div className="rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground leading-snug">
                Refunding {selectedList.length} item{selectedList.length === 1 ? '' : 's'}. Proof and details below apply to every selected item.
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Additional details</label>
              <Textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Provide any additional details..."
                className="rounded-xl resize-none"
                rows={3}
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
                {media.map((item, i) => (
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
                      onClick={() => removeMedia(i)}
                      className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5"
                      aria-label="Remove"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>

              {liveCaptureAvailable && media.length < MAX_ITEMS && (
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

            <div className="flex gap-2">
              {multi && (
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="rounded-full h-12"
                >
                  Back
                </Button>
              )}
              <Button
                onClick={handleSubmit}
                disabled={
                  submitting ||
                  !liveCaptureAvailable ||
                  media.length === 0 ||
                  selectedList.length === 0 ||
                  !allSelectedHaveReason
                }
                className="flex-1 rounded-full bg-charcoal text-white hover:bg-charcoal-light h-12"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit Request'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RefundRequestDialog;
