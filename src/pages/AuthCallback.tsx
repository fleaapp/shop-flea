import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { completeAuthSessionFromUrl } from '@/lib/authRedirects';

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const complete = async () => {
      try {
        const { data } = await completeAuthSessionFromUrl();

        if (cancelled) return;

        if (data.session) {
          navigate('/', { replace: true });
          return;
        }

        toast.error('Verification link expired. Please log in or request a new link.');
        navigate('/auth', { replace: true });
      } catch (error) {
        if (cancelled) return;
        console.error('[auth-callback] failed to complete session:', error);
        toast.error('Could not verify that link. Please try again.');
        navigate('/auth', { replace: true });
      }
    };

    void complete();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return <div className="fixed inset-0 bg-primary" />;
};

export default AuthCallback;