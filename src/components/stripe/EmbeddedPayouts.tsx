import { ConnectPayouts } from '@stripe/react-connect-js';
import FleaConnectProvider from './FleaConnectProvider';

const EmbeddedPayouts = () => (
  <FleaConnectProvider>
    <ConnectPayouts />
  </FleaConnectProvider>
);

export default EmbeddedPayouts;
