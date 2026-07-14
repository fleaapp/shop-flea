import { ConnectPayments } from '@stripe/react-connect-js';
import FleaConnectProvider from './FleaConnectProvider';

const EmbeddedPayments = () => (
  <FleaConnectProvider>
    <ConnectPayments />
  </FleaConnectProvider>
);

export default EmbeddedPayments;
