import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
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
  const location = useLocation();

  if (mode === 'public') {
    return <>{children}</>;
  }

  const authRedirectTo = () => {
    const path = `${location.pathname}${location.search}${location.hash}`;
    // Only preserve non-root paths; avoid redirect=/ noise.
    if (!path || path === '/' ) return '/auth';
    return `/auth?redirect=${encodeURIComponent(path)}`;
  };

  if (mode === 'guest-gate') {
    if (loading) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
    if (user) return <>{children}</>;
    if (isGuest) return <GuestGate />;
    return <Navigate to={authRedirectTo()} replace />;
  }

  if (mode === 'guest-or-auth') {
    if (loading) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
    if (user || isGuest) return <>{children}</>;
    return <Navigate to={authRedirectTo()} replace />;
  }

  // account mode
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to={authRedirectTo()} replace />;
  return <>{children}</>;
};


export default ProtectedRoute;
