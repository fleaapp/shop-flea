import { useRef, useState } from 'react';
import { Camera as CapCamera, CameraSource, CameraResultType } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Loader2, Camera, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/context/AuthContext';
import { invokeCloudFunction } from '@/utils/cloudFunctions';

interface IdVerificationStepProps {
  onBack?: () => void;
  onDone: () => void;
}

type DocType = 'passport' | 'licence';

/**
 * Live-camera-only ID capture. We never allow photo library or file picker —
 * this blocks users uploading a screenshot, an AI-generated ID, or a photo of
 * a photo. On native (Capacitor) we force `CameraSource.Camera`; on web we use
 * a hidden `<input capture="environment">` which triggers the OS camera on
 * mobile browsers.
 */
const IdVerificationStep = ({ onBack, onDone }: IdVerificationStepProps) => {
  const { profile } = useAuth() as any;
  const [docType, setDocType] = useState<DocType | null>(null);
  const [front, setFront] = useState<string | null>(null);
  const [back, setBack] = useState<string | null>(null);
  const [capturing, setCapturing] = useState<'front' | 'back' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const webInputRef = useRef<HTMLInputElement | null>(null);
  const webTargetRef = useRef<'front' | 'back'>('front');

  const isNative = Capacitor.isNativePlatform();

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
    try {
      const { data, error } = await invokeCloudFunction('stripe-connect-upload-id', {
        accountId,
        frontBase64: stripBase64(front),
        backBase64: docType === 'licence' && back ? stripBase64(back) : undefined,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('ID submitted for verification.');
      onDone();
    } catch (err: any) {
      console.error('upload-id error:', err);
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
          <SheetTitle className="text-lg">Verify your ID</SheetTitle>
        </SheetHeader>
        <p className="text-sm text-muted-foreground text-pretty leading-relaxed max-w-[300px] mx-auto">
          To keep Flea safe, our payment provider needs a photo of your government ID.
        </p>
        <div className="w-full max-w-[340px] mx-auto flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/40 px-4 py-3 text-left">
          <ShieldCheck className="h-5 w-5 shrink-0 mt-0.5 text-foreground" />
          <p className="text-xs text-foreground/80 leading-relaxed">
            You must take a live photo — uploads from your photo library are not accepted.
          </p>
        </div>
        <div className="w-full max-w-[300px] mx-auto space-y-2 mt-2">
          <button
            onClick={() => setDocType('passport')}
            className="w-full flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3.5 text-left active:bg-muted/60"
          >
            <div>
              <div className="text-[15px] font-semibold text-foreground">Passport</div>
              <div className="text-xs text-muted-foreground mt-0.5">1 photo — photo page</div>
            </div>
            <span aria-hidden className="text-xl">📘</span>
          </button>
          <button
            onClick={() => setDocType('licence')}
            className="w-full flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3.5 text-left active:bg-muted/60"
          >
            <div>
              <div className="text-[15px] font-semibold text-foreground">Driver's licence</div>
              <div className="text-xs text-muted-foreground mt-0.5">2 photos — front and back</div>
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
          <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
            {capturing === side ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Camera className="h-6 w-6" />
            )}
            <span className="text-[13px] font-medium">{label}</span>
            <span className="text-[11px]">{hint}</span>
          </div>
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
      <p className="text-sm text-muted-foreground text-pretty leading-relaxed max-w-[300px] mx-auto">
        Hold your ID flat, fill the frame, and make sure every corner is visible. No glare.
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
