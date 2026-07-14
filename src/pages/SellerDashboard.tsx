import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { ConnectNotificationBanner } from '@stripe/react-connect-js';
import FleaConnectProvider from '@/components/stripe/FleaConnectProvider';
import EmbeddedPayouts from '@/components/stripe/EmbeddedPayouts';
import EmbeddedBalances from '@/components/stripe/EmbeddedBalances';
import EmbeddedPayments from '@/components/stripe/EmbeddedPayments';
import EmbeddedAccountManagement from '@/components/stripe/EmbeddedAccountManagement';
import { useAuth } from '@/context/AuthContext';

type Tab = 'payouts' | 'balance' | 'payments' | 'account';

const TAB_LABELS: Record<Tab, string> = {
  payouts: 'Payouts',
  balance: 'Balance',
  payments: 'Payments',
  account: 'Account',
};

const SellerDashboard = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('payouts');

  const notConnected =
    !(profile as any)?.stripe_account_id ||
    (profile as any)?.stripe_onboarding_complete !== true;

  return (
    <div className="min-h-svh bg-background flex flex-col">
      <header className="sticky top-0 z-20 bg-background border-b border-border">
        <div className="flex items-center gap-2 px-4 py-3 pt-safe">
          <button
            onClick={() => navigate('/settings')}
            aria-label="Back"
            className="w-9 h-9 flex items-center justify-center -ml-2 rounded-full hover:bg-muted/60 active:bg-muted"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">Seller Dashboard</h1>
        </div>
        <nav className="flex px-2 pb-2 gap-1 overflow-x-auto no-scrollbar">
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 h-8 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors ${
                tab === t
                  ? 'bg-charcoal text-white'
                  : 'bg-muted/60 text-muted-foreground'
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 px-4 py-4 pb-10">
        {notConnected ? (
          <div className="pt-16 text-center text-sm text-muted-foreground max-w-[300px] mx-auto">
            Finish your seller setup to access your dashboard.
          </div>
        ) : (
          <FleaConnectProvider>
            <div className="mb-4">
              <ConnectNotificationBanner />
            </div>
            {tab === 'payouts' && <EmbeddedPayouts />}
            {tab === 'balance' && <EmbeddedBalances />}
            {tab === 'payments' && <EmbeddedPayments />}
            {tab === 'account' && <EmbeddedAccountManagement />}
          </FleaConnectProvider>
        )}
      </main>
    </div>
  );
};

export default SellerDashboard;
