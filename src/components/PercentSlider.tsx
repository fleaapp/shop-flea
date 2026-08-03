import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface PercentSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

/**
 * Depop-style draggable percentage picker. Snaps to `step` increments.
 */
const PercentSlider = ({
  value,
  onChange,
  min = 5,
  max = 50,
  step = 5,
  className,
}: PercentSliderProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const clampToStep = useCallback(
    (raw: number) => {
      const snapped = Math.round((raw - min) / step) * step + min;
      return Math.max(min, Math.min(max, snapped));
    },
    [min, max, step]
  );

  const setFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      onChange(clampToStep(min + ratio * (max - min)));
    },
    [clampToStep, max, min, onChange]
  );

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      e.preventDefault();
      setFromClientX(e.clientX);
    };
    const up = () => setDragging(false);
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [dragging, setFromClientX]);

  const percent = ((Math.max(min, Math.min(max, value)) - min) / (max - min)) * 100;

  return (
    <div className={cn('select-none', className)}>
      <p className="text-center text-3xl font-extrabold text-foreground tabular-nums">
        {value}%
      </p>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label="Discount percentage"
        onPointerDown={(e) => {
          e.preventDefault();
          setDragging(true);
          setFromClientX(e.clientX);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault();
            onChange(clampToStep(value - step));
          }
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault();
            onChange(clampToStep(value + step));
          }
        }}
        className="relative mt-3 h-11 flex items-center cursor-pointer touch-none"
      >
        <div className="h-2 w-full rounded-full bg-secondary" />
        <div
          className="absolute left-0 h-2 rounded-full bg-charcoal"
          style={{ width: `${percent}%` }}
        />
        <div
          className="absolute h-7 w-7 -translate-x-1/2 rounded-full border-[3px] border-charcoal bg-background shadow-sm"
          style={{ left: `${percent}%` }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{min}%</span>
        <span>{max}%</span>
      </div>
    </div>
  );
};

export default PercentSlider;
