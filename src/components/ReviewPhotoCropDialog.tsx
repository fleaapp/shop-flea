import { useState, useCallback } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { X, ZoomIn } from 'lucide-react';

interface ReviewPhotoCropDialogProps {
  open: boolean;
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('No canvas context'));
      ctx.drawImage(
        image,
        pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
        0, 0, pixelCrop.width, pixelCrop.height
      );
      canvas.toBlob(
        (blob) => { if (blob) resolve(blob); else reject(new Error('Canvas toBlob failed')); },
        'image/jpeg',
        0.9
      );
    };
    image.onerror = reject;
    image.src = imageSrc;
  });
}

const ReviewPhotoCropDialog = ({ open, imageSrc, onCropComplete, onCancel }: ReviewPhotoCropDialogProps) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const onCropAreaComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    setSaving(true);
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
      onCropComplete(blob);
    } catch {
      onCancel();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-safe-top pt-4 pb-3 shrink-0">
        <button
          onClick={onCancel}
          className="flex items-center justify-center h-10 w-10 rounded-full bg-white/10 text-white"
        >
          <X className="h-5 w-5" />
        </button>
        <span className="text-white font-semibold text-base">Crop Photo</span>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="h-9 px-5 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Use Photo'}
        </Button>
      </div>

      {/* Cropper — fills remaining space as a square */}
      <div className="relative flex-1 w-full">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="rect"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropAreaComplete}
          style={{
            containerStyle: { background: '#000' },
          }}
        />
      </div>

      {/* Zoom slider */}
      <div className="shrink-0 px-6 pt-5 pb-safe-bottom pb-8 flex items-center gap-4">
        <ZoomIn className="h-5 w-5 text-white/60 shrink-0" />
        <Slider
          value={[zoom]}
          min={1}
          max={3}
          step={0.05}
          onValueChange={([v]) => setZoom(v)}
          className="flex-1"
        />
      </div>
    </div>
  );
};

export default ReviewPhotoCropDialog;
