import { useEffect, useRef, useState } from 'react';
import { Camera as CapCamera, CameraSource, CameraResultType } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Loader2, Camera, ShieldCheck, AlertTriangle, HelpCircle, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/context/AuthContext';
import { invokeCloudFunction } from '@/utils/cloudFunctions';
import { track } from '@/lib/analytics';

interface IdVerificationStepProps {
  onBack?: () => void;
  onDone: () => void;
  /** Called when the user says the ID name doesn't match the entered name. */
  onEditName?: () => void;
  /** Structured error from Stripe requirements — used to explain why the last upload failed. */
  verificationError?: { code: string | null; reason: string | null; nameMismatch: boolean } | null;
}

type DocType = 'passport' | 'licence';

/**
 * Turns a Stripe verification error code/reason into human copy. We prefer the
 * code so the message is stable across Stripe wording changes.
 */
function readableRejectReason(err: { code: string | null; reason: string | null } | null | undefined): string | null {
  if (!err) return null;
  const code = (err.code || '').toLowerCase();
  if (!code && !err.reason) return null;
  if (code.includes('not_readable') || code.includes('not_uploaded') || code.includes('failed_copy'))
    return 'Your last photo was too blurry or had glare. Retake it in bright, even light with the whole document in frame.';
  if (code.includes('expired'))
    return 'The ID you uploaded has expired. Please use a current passport or driver\'s licence.';
  if (code.includes('type_not_supported') || code.includes('unsupported'))
    return 'That document type isn\'t accepted. Use an Australian passport or a full (not learner) driver\'s licence.';
  if (code.includes('name') || code.includes('keyed'))
    return 'The name on your ID didn\'t match the name you entered. Update your name or upload an ID that matches.';
  if (code.includes('dob'))
    return 'The date of birth on your ID didn\'t match what you entered. Please check and try again.';
  if (code.includes('photo_mismatch'))
    return 'The photo on your ID couldn\'t be verified. Retake it with better lighting and a clean background.';
  return err.reason || 'Your last upload couldn\'t be verified. Please try again with a clearer photo.';
}

/**
 * Live-camera-only ID capture. We never allow photo library or file picker —
 * this blocks users uploading a screenshot, an AI-generated ID, or a photo of
 * a photo. On native (Capacitor) we force `CameraSource.Camera`; on web we use
 * a hidden `<input capture="environment">` which triggers the OS camera on
 * mobile browsers.
 */
const IdVerificationStep = ({ onBack, onDone, onEditName, verificationError }: IdVerificationStepProps) => {
  const { profile } = useAuth() as any;
  const [docType, setDocType] = useState<DocType | null>(null);
  const [front, setFront] = useState<string | null>(null);
  const [back, setBack] = useState<string | null>(null);
  const [capturing, setCapturing] = useState<'front' | 'back' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const webInputRef = useRef<HTMLInputElement | null>(null);
  const webTargetRef = useRef<'front' | 'back'>('front');

  const isNative = Capacitor.isNativePlatform();
  const rejectMessage = readableRejectReason(verificationError);
  const isNameMismatch = !!verificationError?.nameMismatch;

  useEffect(() => {
    track('id_verification_started', {
      hadPreviousReject: !!verificationError,
      rejectCode: verificationError?.code ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const captureNative = async (side: 'front' | 'back') => {
    setCapturing(side);
    try {
      const photo = await CapCamera.getPhoto({
        source: CameraSource.Camera, // Live camera only. No gallery.
        resultType: CameraResultType.Base64,
        quality: 70,
        allowEditing: false,
        saveToGallery: false,
        correctOrientation: true,
      });
      const b64 = photo.base64String;
      if (!b64) throw new Error('No photo captured.');
      const dataUrl = `data:image/${photo.format || 'jpeg'};base64,${b64}`;
      if (side === 'front') setFront(dataUrl);
      else setBack(dataUrl);
      track('id_verification_captured', { side, docType });
    } catch (err: any) {
      const msg = err?.message || '';
      if (!/cancel/i.test(msg)) toast.error(msg || 'Camera unavailable.');
    } finally {
      setCapturing(null);
    }
  };

  const captureWeb = (side: 'front' | 'back') => {
    webTargetRef.current = side;
    webInputRef.current?.click();
  };

  const handleWebFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (webTargetRef.current === 'front') setFront(dataUrl);
      else setBack(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const capture = (side: 'front' | 'back') => {
    if (isNative) captureNative(side);
    else captureWeb(side);
  };

  const stripBase64 = (dataUrl: string) => dataUrl.replace(/^data:image\/\w+;base64,/, '');

  // Downscale to max 1600px and re-encode as JPEG q=0.82 to cut upload size
  // (Stripe rejects docs > 8MB and slow AU mobile networks choke on large base64).
  const compressDataUrl = (dataUrl: string): Promise<string> =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1600;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const scale = Math.min(MAX / width, MAX / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(dataUrl);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });

  const canSubmit =
    !!front &&
    (docType === 'passport' || (docType === 'licence' && !!back)) &&
    !submitting;

  const submit = async () => {
    const accountId = (profile as any)?.stripe_account_id;
    if (!accountId) {
      toast.error('Payment account not ready.');
      return;
    }
    if (!front) return;
    setSubmitting(true);
    track('id_verification_uploaded', { docType });
    try {
      const frontCompressed = await compressDataUrl(front);
      const backCompressed = docType === 'licence' && back ? await compressDataUrl(back) : undefined;
      const { data, error } = await invokeCloudFunction('stripe-connect-upload-id', {
        accountId,
        frontBase64: stripBase64(frontCompressed),
        backBase64: backCompressed ? stripBase64(backCompressed) : undefined,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      track('id_verification_submitted', { docType });
      toast.success('ID submitted for verification.');
      setSubmitted(true);
    } catch (err: any) {
      console.error('upload-id error:', err);
      track('id_verification_stripe_rejected', { message: err?.message ?? null });
      toast.error(err?.message || 'Could not submit ID. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Doc type picker ----------
  if (!docType) {
    return (
      <>
        <SheetHeader className="space-y-2">
          <SheetTitle className="text-lg">Extra ID needed</SheetTitle>
        </SheetHeader>
        <p className="text-sm text-muted-foreground text-pretty leading-relaxed max-w-[320px] mx-auto">
          Our payment provider needs one more document to finish verifying your identity. The details you gave earlier weren't enough on their own, so a clear photo of your government ID is required before your payouts can be unlocked.
        </p>

        {rejectMessage && (
          <div className="w-full max-w-[340px] mx-auto flex items-start gap-3 rounded-2xl border border-orange-300/60 bg-orange-50 dark:bg-orange-950/30 px-4 py-3 text-left">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-orange-600" />
            <p className="text-xs text-foreground/90 leading-relaxed">
              {rejectMessage}
            </p>
          </div>
        )}

        {isNameMismatch && onEditName && (
          <button
            type="button"
            onClick={() => {
              track('id_verification_edit_name_opened');
              onEditName();
            }}
            className="w-full max-w-[340px] mx-auto flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-left active:bg-muted/60"
          >
            <div>
              <div className="text-[14px] font-semibold text-foreground">My name doesn't match my ID</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Edit your legal name, then upload again.</div>
            </div>
            <span aria-hidden className="text-lg">✏️</span>
          </button>
        )}

        <div className="w-full max-w-[340px] mx-auto flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/40 px-4 py-3 text-left">
          <ShieldCheck className="h-5 w-5 shrink-0 mt-0.5 text-foreground" />
          <p className="text-xs text-foreground/80 leading-relaxed">
            You must take a live photo. Uploads from your photo library are not accepted, to protect against fraud and fake IDs.
          </p>
        </div>

        {/* Apple review-friendly: explain up front why we ask for ID. */}
        <button
          type="button"
          onClick={() => setShowWhy((v) => !v)}
          className="w-full max-w-[340px] mx-auto flex items-center justify-between rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-left"
          aria-expanded={showWhy}
        >
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-foreground" />
            <span className="text-[13px] font-medium text-foreground">Why do we need this?</span>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showWhy ? 'rotate-180' : ''}`} />
        </button>
        {showWhy && (
          <p className="w-full max-w-[340px] mx-auto text-xs text-muted-foreground leading-relaxed text-left -mt-2">
            Australian law requires our payment provider to verify the identity of anyone receiving payouts. This protects buyers from fraud and keeps the marketplace safe. Your ID is sent encrypted, straight to the payment provider, and Flea never stores a copy. If you'd rather not, you can close this screen — you just won't be able to sell until it's completed.
          </p>
        )}

        <div className="w-full max-w-[300px] mx-auto space-y-2 mt-2">
          <button
            onClick={() => setDocType('passport')}
            className="w-full flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3.5 text-left active:bg-muted/60"
          >
            <div>
              <div className="text-[15px] font-semibold text-foreground">Passport</div>
              <div className="text-xs text-muted-foreground mt-0.5">1 photo of the photo page</div>
            </div>
            <span aria-hidden className="text-xl">📘</span>
          </button>
          <button
            onClick={() => setDocType('licence')}
            className="w-full flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3.5 text-left active:bg-muted/60"
          >
            <div>
              <div className="text-[15px] font-semibold text-foreground">Driver's licence</div>
              <div className="text-xs text-muted-foreground mt-0.5">2 photos, front and back</div>
            </div>
            <span aria-hidden className="text-xl">🪪</span>
          </button>
        </div>
        {onBack && (
          <Button
            variant="ghost"
            onClick={onBack}
            className="w-auto h-10 px-4 rounded-full bg-transparent text-muted-foreground hover:bg-transparent hover:text-muted-foreground mt-1"
          >
            Back
          </Button>
        )}
      </>
    );
  }

  // ---------- Capture cards ----------
  const CaptureCard = ({
    side,
    label,
    hint,
    img,
  }: {
    side: 'front' | 'back';
    label: string;
    hint: string;
    img: string | null;
  }) => (
    <div className="w-full">
      <button
        type="button"
        onClick={() => capture(side)}
        disabled={capturing === side}
        className="relative w-full aspect-[85/54] rounded-2xl border-2 border-dashed border-border bg-muted/40 flex items-center justify-center overflow-hidden active:bg-muted/60"
      >
        {img ? (
          <img src={img} alt={label} className="w-full h-full object-cover" />
        ) : (
          <>
            {/* Frame guide + hold-steady hint. Corner brackets show the user
                roughly where the ID should sit so first-try captures land
                inside Stripe's readable area. */}
            <div className="pointer-events-none absolute inset-3 rounded-xl">
              <span className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-foreground/70 rounded-tl-md" />
              <span className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-foreground/70 rounded-tr-md" />
              <span className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-foreground/70 rounded-bl-md" />
              <span className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-foreground/70 rounded-br-md" />
            </div>
            <div className="flex flex-col items-center gap-1.5 text-muted-foreground relative z-10">
              {capturing === side ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Camera className="h-6 w-6" />
              )}
              <span className="text-[13px] font-medium">{label}</span>
              <span className="text-[11px]">{hint}</span>
              <span className="text-[10px] text-muted-foreground/80">Hold steady inside the frame.</span>
            </div>
          </>
        )}
        {img && (
          <span className="absolute top-2 right-2 rounded-full bg-background/90 text-foreground text-[11px] font-medium px-2 py-1">
            Retake
          </span>
        )}
      </button>
    </div>
  );

  return (
    <>
      <SheetHeader className="space-y-2">
        <SheetTitle className="text-lg">
          {docType === 'passport' ? 'Photograph your passport' : 'Photograph your licence'}
        </SheetTitle>
      </SheetHeader>
      <p className="text-sm text-muted-foreground text-pretty leading-relaxed max-w-[320px] mx-auto">
        Hold your ID flat, fill the frame, and keep every corner visible. Avoid glare so our payment provider can read the details clearly.
      </p>

      <div className="w-full max-w-[340px] mx-auto space-y-3 mt-1">
        <CaptureCard
          side="front"
          label={docType === 'passport' ? 'Take photo of photo page' : 'Take photo of front'}
          hint="Live camera only"
          img={front}
        />
        {docType === 'licence' && (
          <CaptureCard
            side="back"
            label="Take photo of back"
            hint="Live camera only"
            img={back}
          />
        )}
      </div>

      <div className="w-full max-w-[340px] mx-auto flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/40 px-4 py-3 text-left mt-1">
        <ShieldCheck className="h-5 w-5 shrink-0 mt-0.5 text-foreground" />
        <p className="text-xs text-foreground/80 leading-relaxed">
          Your ID is encrypted and sent directly to our payment provider for verification.
          Flea never stores it.
        </p>
      </div>

      <div className="w-full space-y-2 mt-2 flex flex-col items-center">
        <Button
          onClick={submit}
          disabled={!canSubmit}
          className="w-56 h-12 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-[15px] font-semibold disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Submitting...
            </>
          ) : (
            'Submit for verification'
          )}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setFront(null);
            setBack(null);
            setDocType(null);
          }}
          disabled={submitting}
          className="w-auto h-10 px-4 rounded-full bg-transparent text-muted-foreground hover:bg-transparent hover:text-muted-foreground"
        >
          Change ID type
        </Button>
      </div>

      {/* Web fallback: hidden input forces OS camera on mobile browsers.
          On desktop it opens a file picker — acceptable for preview only,
          native builds always use the Capacitor Camera path above. */}
      {!isNative && (
        <input
          ref={webInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            handleWebFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      )}
    </>
  );
};

export default IdVerificationStep;
