import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import applePayLogo from '@/assets/applepay-logo.png';
import gPayLogo from '@/assets/gpay-logo.png';
import { CreditCard } from 'lucide-react';
import { invokeCloudFunction } from '@/utils/cloudFunctions';
import { cn } from '@/lib/utils';
import { getStripe } from '@/lib/stripe/loadStripe';

export type SavedCard = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number | null;
  expYear: number | null;
};

export type SelectedPaymentMethod =
  | { kind: 'wallet'; wallet: WalletKind }
  | { kind: 'saved'; card: SavedCard }
  | { kind: 'new_card' };

interface Props {
  value: SelectedPaymentMethod | null;
  onChange: (v: SelectedPaymentMethod) => void;
  amountCents: number;
}

type WalletKind = 'apple' | 'google';

function detectNativeWallet(): WalletKind | null {
  if (!Capacitor.isNativePlatform()) return null;
  const platform = Capacitor.getPlatform();
  if (platform === 'ios') return 'apple';
  if (platform === 'android') return 'google';
  return null;
}

const Radio = ({ selected }: { selected: boolean }) => (
  <div
    className={cn(
      'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
      selected ? 'border-charcoal' : 'border-muted-foreground/40'
    )}
  >
    {selected && <div className="w-2.5 h-2.5 rounded-full bg-charcoal" />}
  </div>
);

const brandLabel = (brand: string) => {
  const map: Record<string, string> = {
    visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex',
    discover: 'Discover', jcb: 'JCB', unionpay: 'UnionPay', eftpos_au: 'eftpos',
  };
  return map[brand] || brand.charAt(0).toUpperCase() + brand.slice(1);
};

const PaymentMethodPicker = ({ value, onChange, amountCents }: Props) => {
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<WalletKind | null>(() => detectNativeWallet());
  const [walletLoading, setWalletLoading] = useState(!Capacitor.isNativePlatform());

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      setWallet(detectNativeWallet());
      setWalletLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        if (amountCents <= 0) {
          setWallet(null);
          return;
        }

        const stripe = await getStripe();
        if (!stripe || cancelled) return;

        const paymentRequest = stripe.paymentRequest({
          country: 'AU',
          currency: 'aud',
          total: { label: 'Flea', amount: amountCents },
        });
        const result = await paymentRequest.canMakePayment();
        if (cancelled) return;

        if (result?.applePay) setWallet('apple');
        else if (result?.googlePay) setWallet('google');
        else setWallet(null);
      } catch (e) {
        if (!cancelled) {
          console.warn('wallet availability:', e);
          setWallet(null);
        }
      } finally {
        if (!cancelled) setWalletLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [amountCents]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await invokeCloudFunction('stripe-list-saved-cards', { method: 'GET' });
        if (!cancelled && data?.cards) setSavedCards(data.cards);
      } catch (e) {
        console.error('load saved cards:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Auto-select the first available method the first time we render
  useEffect(() => {
    if (loading || walletLoading || value) return;
    if (savedCards.length > 0) {
      onChange({ kind: 'saved', card: savedCards[0] });
    } else if (wallet) {
      onChange({ kind: 'wallet', wallet });
    } else {
      onChange({ kind: 'new_card' });
    }
  }, [loading, walletLoading, value, savedCards, wallet, onChange]);

  useEffect(() => {
    if (walletLoading || value?.kind !== 'wallet' || wallet) return;
    if (savedCards.length > 0) {
      onChange({ kind: 'saved', card: savedCards[0] });
    } else {
      onChange({ kind: 'new_card' });
    }
  }, [walletLoading, value, wallet, savedCards, onChange]);

  const isWalletSelected = value?.kind === 'wallet' && value.wallet === wallet;
  const isNewCardSelected = value?.kind === 'new_card';

  return (
    <div className="rounded-xl bg-card overflow-hidden">
      <div className="px-4 pt-3 pb-2">
        <h3 className="text-base font-bold text-foreground">Payment type</h3>
      </div>

      <div className="divide-y divide-border/60">
        {!wallet && walletLoading && !savedCards.length && (
          <div className="px-4 py-3">
            <div className="h-12 rounded-lg bg-muted animate-pulse" />
          </div>
        )}

        {/* Saved cards */}
        {savedCards.map((card) => {
          const selected = value?.kind === 'saved' && value.card.id === card.id;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onChange({ kind: 'saved', card })}
              className="w-full flex items-center gap-3 px-4 py-3 text-left"
            >
              <Radio selected={selected} />
              <div className="flex items-center justify-center w-11 h-7 rounded-md border border-border">
                <CreditCard size={16} className="text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-semibold text-foreground">
                  {brandLabel(card.brand)} •••• {card.last4}
                </p>
                {card.expMonth && card.expYear && (
                  <p className="text-xs text-muted-foreground">
                    Expires {String(card.expMonth).padStart(2, '0')}/{String(card.expYear).slice(-2)}
                  </p>
                )}
              </div>
            </button>
          );
        })}

        {/* Wallet row */}
        {wallet && (
          <button
            type="button"
            onClick={() => onChange({ kind: 'wallet', wallet })}
            className="w-full flex items-center gap-3 px-4 py-3 text-left"
          >
            <Radio selected={isWalletSelected} />
            <div className="flex items-center justify-center w-11 h-7 rounded-md border border-border">
              <img
                src={wallet === 'apple' ? applePayLogo : gPayLogo}
                alt={wallet === 'apple' ? 'Apple Pay' : 'Google Pay'}
                className={wallet === 'apple' ? 'h-4' : 'h-3'}
              />
            </div>
            <p className="text-[15px] font-semibold text-foreground">
              {wallet === 'apple' ? 'Apple Pay' : 'Google Pay'}
            </p>
          </button>
        )}

        {/* Add new card */}
        <button
          type="button"
          onClick={() => onChange({ kind: 'new_card' })}
          className="w-full flex items-center gap-3 px-4 py-3 text-left"
        >
          <Radio selected={isNewCardSelected} />
          <div className="flex items-center justify-center w-11 h-7 rounded-md border border-border">
            <CreditCard size={16} className="text-muted-foreground" />
          </div>
          <p className="text-[15px] font-semibold text-foreground">Add new card</p>
        </button>
      </div>
    </div>
  );
};

export default PaymentMethodPicker;
