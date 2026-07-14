import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { invokeCloudFunction } from '@/utils/cloudFunctions';
import { cn } from '@/lib/utils';
import { Loader2, X } from 'lucide-react';

export type AppliedCoupon = {
  code: string;
  type: string;
  message: string;
};

interface CouponInputProps {
  value: AppliedCoupon | null;
  onChange: (c: AppliedCoupon | null) => void;
}

const CouponInput = ({ value, onChange }: CouponInputProps) => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!value) setInput('');
  }, [value]);

  const apply = async () => {
    const code = input.trim().toUpperCase();
    if (!code) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await invokeCloudFunction('validate-coupon', { code });
      if (err) throw new Error(err.message || 'Could not validate code');
      if (!(data as any)?.valid) {
        setError((data as any)?.message || "That code isn't valid.");
        onChange(null);
        return;
      }
      onChange({
        code: (data as any).code,
        type: (data as any).type,
        message: (data as any).message,
      });
    } catch (e: any) {
      setError(e?.message || 'Could not validate code.');
    } finally {
      setLoading(false);
    }
  };

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-lg bg-primary/25 border border-primary px-3 py-2">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-charcoal">{value.code} applied</span>
          <span className="text-[11px] text-charcoal/70">{value.message}</span>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Remove coupon"
          className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-charcoal/10"
        >
          <X className="h-4 w-4 text-charcoal" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => { setInput(e.target.value.toUpperCase()); setError(null); }}
          placeholder="Coupon code"
          className={cn('h-10 rounded-lg bg-background border-border uppercase', error && 'border-destructive')}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } }}
        />
        <Button
          type="button"
          onClick={apply}
          disabled={loading || !input.trim()}
          className="h-10 px-4 rounded-lg bg-charcoal text-white hover:bg-charcoal/90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
        </Button>
      </div>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
};

export default CouponInput;
