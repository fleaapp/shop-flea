import { Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const BUILD_ID = (import.meta.env.VITE_BUILD_ID as string | undefined) ?? '0';

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [waited, setWaited] = useState(0);

  // Hard safety: if loading is still true after 2s, force-redirect to /auth.
  useEffect(() => {
    if (!loading) return;
    const tick = setInterval(() => setWaited((w) => w + 1), 1000);
    const escape = setTimeout(() => {
      console.warn('[ProtectedRoute] loading stuck >2.5s — forcing /auth');
      navigate('/auth', { replace: true });
    }, 2500);
    return () => {
      clearInterval(tick);
      clearTimeout(escape);
    };
  }, [loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="text-5xl">⏳</span>
        <div className="text-xs font-mono text-foreground/70">
          loading… {waited}s
        </div>
        <div className="text-[10px] font-mono text-foreground/50">
          build {BUILD_ID}
        </div>
        <button
          onClick={() => navigate('/auth', { replace: true })}
          className="mt-2 rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground"
        >
          Go to sign in
        </button>
        <button
          onClick={() => {
            try {
              Object.keys(localStorage)
                .filter((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
                .forEach((k) => localStorage.removeItem(k));
            } catch {}
            window.location.href = '/auth';
          }}
          className="rounded-full bg-muted px-5 py-2 text-xs font-bold text-foreground"
        >
          Reset session & reload
        </button>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
