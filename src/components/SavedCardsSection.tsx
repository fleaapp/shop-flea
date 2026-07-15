import { useEffect, useState } from 'react';
import { CreditCard, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { invokeCloudFunction } from '@/utils/cloudFunctions';
import type { SavedCard } from '@/components/checkout/PaymentMethodPicker';

const brandLabel = (brand: string) => {
  const map: Record<string, string> = {
    visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex',
    discover: 'Discover', jcb: 'JCB', unionpay: 'UnionPay', eftpos_au: 'eftpos',
  };
  return map[brand] || brand.charAt(0).toUpperCase() + brand.slice(1);
};

const SavedCardsSection = () => {
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await invokeCloudFunction('stripe-list-saved-cards', { method: 'GET' });
        if (!cancelled && data?.cards) setCards(data.cards);
      } catch (e) {
        console.error('load saved cards:', e);
        if (!cancelled) setLoadFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleDelete = async (card: SavedCard) => {
    if (!confirm(`Remove ${brandLabel(card.brand)} •••• ${card.last4}?`)) return;
    try {
      await invokeCloudFunction('stripe-detach-card', { paymentMethodId: card.id });
      setCards((prev) => prev.filter((c) => c.id !== card.id));
      toast.success('Card removed.');
    } catch (err) {
      console.error(err);
      toast.error('Could not remove card.');
    }
  };

  return (
    <div>
      <h2 className="mb-3 max-[375px]:mb-2 text-sm max-[375px]:text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Saved Cards
      </h2>
      <div className="space-y-2 max-[375px]:space-y-1.5">
        {loading ? (
          <div className="rounded-2xl p-4 pl-6 max-[375px]:p-3 max-[375px]:pl-5 card-shadow bg-card">
            <p className="text-sm text-muted-foreground">Loading saved cards...</p>
          </div>
        ) : loadFailed ? (
          <div className="rounded-2xl p-4 pl-6 max-[375px]:p-3 max-[375px]:pl-5 card-shadow bg-card">
            <p className="text-sm text-muted-foreground">Saved cards could not be loaded.</p>
          </div>
        ) : cards.length === 0 ? (
          <div className="rounded-2xl p-4 pl-6 max-[375px]:p-3 max-[375px]:pl-5 card-shadow bg-card">
            <p className="text-sm text-muted-foreground">No saved cards yet.</p>
          </div>
        ) : cards.map((card) => (
          <div
            key={card.id}
            className="flex items-center justify-between rounded-2xl p-4 pl-6 max-[375px]:p-3 max-[375px]:pl-5 card-shadow bg-card"
          >
            <div className="flex items-center gap-3 max-[375px]:gap-2">
              <div className="flex items-center justify-center w-10 h-7 rounded-md border border-border">
                <CreditCard size={16} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-base max-[375px]:text-sm font-medium text-foreground">
                  {brandLabel(card.brand)} •••• {card.last4}
                </p>
                {card.expMonth && card.expYear && (
                  <p className="text-xs text-muted-foreground">
                    Expires {String(card.expMonth).padStart(2, '0')}/{String(card.expYear).slice(-2)}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              aria-label="Remove card"
              onClick={() => handleDelete(card)}
              className="p-2 -mr-1 text-muted-foreground hover:text-destructive"
            >
              <Trash2 size={20} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SavedCardsSection;
