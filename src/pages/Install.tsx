import { useState, useEffect } from 'react';
import { ArrowLeft, Download, Share, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { safeNavigateBack } from '@/utils/safeBack';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const Install = () => {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android'>('ios');

  useEffect(() => {
    // Ensure the main app manifest is used (not /about.webmanifest if user
    // navigated here from the About page).
    const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const prevManifest = manifestLink?.getAttribute('href') ?? null;
    if (manifestLink) manifestLink.setAttribute('href', '/manifest.webmanifest');

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Detect platform
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) setPlatform('android');
    else setPlatform('ios');

    // Listen for the install prompt (Android/Chrome)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      if (manifestLink && prevManifest) manifestLink.setAttribute('href', prevManifest);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-8 gap-6">
        <span className="text-6xl">✅</span>
        <h1 className="text-2xl font-bold text-foreground text-center">Flea is installed!</h1>
        <p className="text-muted-foreground text-center">
          You can now open Flea from your home screen.
        </p>
        <Button onClick={() => navigate('/')} className="rounded-full bg-charcoal text-white h-12 px-8">
          Open Flea
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="relative flex items-center justify-center px-4 py-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => safeNavigateBack(navigate, '/')}
          className="absolute left-2 rounded-full"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Get the App</h1>
      </header>

      <div className="px-6 py-8 flex flex-col items-center gap-8">
        <img src="/pwa-icon-512.png" alt="Flea" className="w-24 h-24 rounded-2xl shadow-lg" />

        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Download Flea</h2>
          <p className="text-muted-foreground">
            Add Flea to your Home Screen.
          </p>
          <p className="text-muted-foreground font-semibold">
            No App Store needed!
          </p>
        </div>

        {/* Platform toggle */}
        <div className="inline-flex bg-muted rounded-full p-1">
          <button
            onClick={() => setPlatform('ios')}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition ${platform === 'ios' ? 'bg-charcoal text-white' : 'text-foreground'}`}
          >
            iPhone
          </button>
          <button
            onClick={() => setPlatform('android')}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition ${platform === 'android' ? 'bg-charcoal text-white' : 'text-foreground'}`}
          >
            Android
          </button>
        </div>

        {/* Android automatic install button */}
        {platform === 'android' && deferredPrompt && (
          <Button
            onClick={handleInstall}
            className="w-full h-14 rounded-full bg-charcoal text-white text-base font-semibold gap-2"
          >
            <Download className="h-5 w-5" />
            Install Flea
          </Button>
        )}

        {/* iPhone instructions */}
        {platform === 'ios' && (
          <div className="w-full bg-muted/50 rounded-2xl p-6 space-y-4">
            <h3 className="font-semibold text-foreground text-center">How to install on iPhone</h3>
            <div className="space-y-3">
              {[
                <>Tap the <strong>three dots</strong> in the bottom right corner</>,
                <>Tap <Share className="inline h-4 w-4 -mt-0.5" /> <strong>Share</strong></>,
                <>Tap <strong>View more</strong></>,
                <>Tap <Plus className="inline h-4 w-4 -mt-0.5" /> <strong>Add to Home Screen</strong></>,
                <>Make sure <strong>Open as Web App</strong> is toggled on</>,
                <>Tap <strong>Add</strong></>,
                <>Flea will appear on your Home Screen</>,
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-sm font-bold">{i + 1}</div>
                  <p className="text-sm text-foreground pt-1">{step}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Android instructions */}
        {platform === 'android' && (
          <div className="w-full bg-muted/50 rounded-2xl p-6 space-y-4">
            <h3 className="font-semibold text-foreground text-center">How to install on Android</h3>
            <div className="space-y-3">
              {[
                <>Open Flea in <strong>Chrome</strong></>,
                <>Tap the <strong>three dots</strong> menu in the top right corner</>,
                <>Tap <strong>Add to Home screen</strong> or <strong>Install app</strong></>,
                <>Tap <strong>Install</strong> to confirm</>,
                <>Flea will appear on your Home Screen</>,
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-sm font-bold">{i + 1}</div>
                  <p className="text-sm text-foreground pt-1">{step}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Install;
