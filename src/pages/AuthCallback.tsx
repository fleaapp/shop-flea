import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { completeAuthSessionFromUrl, NATIVE_APP_SCHEME } from '@/lib/authRedirects';
import { OAUTH_COMPLETE_MESSAGE } from '@/lib/oauthPopup';

const isNativeShell = (): boolean => {
  try {
    const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    return !!cap?.isNativePlatform?.();
  } catch {
    return false;
  }
};

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const complete = async () => {
      const search = new URLSearchParams(window.location.search);
      const isPopup = search.get('opener') === '1' && !!window.opener;

      // Native sign-in lands here inside the in-app browser sheet. The OAuth
      // code can only be exchanged by the app itself (it holds the PKCE
      // verifier), so hand the parameters straight to the app's URL scheme -
      // iOS closes the sheet and opens the app.
      if (search.get('native') === '1' && !isNativeShell()) {
        const params = new URLSearchParams(window.location.search);
        params.delete('native');
        const query = params.toString();
        window.location.replace(
          `${NATIVE_APP_SCHEME}:/auth/callback${query ? `?${query}` : ''}${window.location.hash}`,
        );
        return;
      }

      try {
        const { data } = await completeAuthSessionFromUrl();


        if (cancelled) return;

        // Popup path: hand control back to the app window and close.
        if (isPopup) {
          try {
            window.opener.postMessage({ type: OAUTH_COMPLETE_MESSAGE }, window.location.origin);
          } catch {
            /* noop */
          }
          window.close();
          return;
        }

        if (data.session) {
          navigate('/', { replace: true });
          return;
        }

        toast.error('Verification link expired. Please log in or request a new link.');
        navigate('/auth', { replace: true });
      } catch (error) {
        if (cancelled) return;
        console.error('[auth-callback] failed to complete session:', error);
        if (isPopup) {
          window.close();
          return;
        }
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
