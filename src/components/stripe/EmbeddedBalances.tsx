import { ConnectBalances } from '@stripe/react-connect-js';
import FleaConnectProvider from './FleaConnectProvider';

const EmbeddedBalances = () => (
  <FleaConnectProvider>
    <ConnectBalances />
  </FleaConnectProvider>
);

export default EmbeddedBalances;
