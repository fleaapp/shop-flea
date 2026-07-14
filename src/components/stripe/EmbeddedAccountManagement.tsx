import { ConnectAccountManagement, ConnectNotificationBanner } from '@stripe/react-connect-js';
import FleaConnectProvider from './FleaConnectProvider';

const EmbeddedAccountManagement = () => (
  <FleaConnectProvider>
    <ConnectNotificationBanner />
    <div className="mt-4">
      <ConnectAccountManagement />
    </div>
  </FleaConnectProvider>
);

export default EmbeddedAccountManagement;
