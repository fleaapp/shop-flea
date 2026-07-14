import { ConnectAccountOnboarding } from '@stripe/react-connect-js';
import FleaConnectProvider from './FleaConnectProvider';

interface Props {
  onExit?: () => void;
}

/**
 * Embedded Stripe Connect onboarding — collects identity, address, DOB, phone
 * and bank/debit card. Zero Stripe branding surfaces to the seller.
 */
const EmbeddedOnboarding = ({ onExit }: Props) => {
  return (
    <FleaConnectProvider>
      <ConnectAccountOnboarding onExit={() => onExit?.()} />
    </FleaConnectProvider>
  );
};

export default EmbeddedOnboarding;
