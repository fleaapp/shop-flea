import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useGuestMode } from '@/context/GuestModeContext';
import GuestGate from '@/components/GuestGate';

type ProtectedMode = 'account' | 'public' | 'guest-gate' | 'guest-or-auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /**
   * account (default): must be signed in; guests/anon redirected to /auth.
   * public: anyone can view (signed in, guest, or anon).
   * guest-gate: signed-in users see the page; guests see the GuestGate welcome; anon redirected to /auth.
   * guest-or-auth: signed-in users AND guests see the page; anonymous users redirected to /auth.
   */
  mode?: ProtectedMode;
}

const ProtectedRoute = ({ children, mode = 'account' }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const { isGuest } = useGuestMode();

  if (mode === 'public') {
    return <>{children}</>;
  }

  if (mode === 'guest-gate') {
    if (user) return <>{children}</>;
    if (isGuest) return <GuestGate />;
    return <Navigate to="/auth" replace />;
  }

  if (mode === 'guest-or-auth') {
    if (user || isGuest) return <>{children}</>;
    return <Navigate to="/auth" replace />;
  }

  // account mode
  if (loading) return <Navigate to="/auth" replace />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

export default ProtectedRoute;
