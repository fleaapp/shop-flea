import { useState, useEffect } from 'react';
import { ArrowLeft, Download, Share, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const Install = () => {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Detect platform
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua));
    setIsAndroid(/android/i.test(ua));

    // Listen for the install prompt (Android/Chrome)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
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
          onClick={() => navigate(-1)}
          className="absolute left-2 rounded-full"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Get the App</h1>
      </header>

      <div className="px-6 py-8 flex flex-col items-center gap-8">
        <img src="/pwa-icon-512.png" alt="Flea" className="w-24 h-24 rounded-2xl shadow-lg" />

        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Install Flea</h2>
          <p className="text-muted-foreground">
            Add Flea to your home screen for the full app experience — full-screen, fast, and no browser bars.
          </p>
        </div>

        {/* Android / Chrome — automatic install button */}
        {deferredPrompt && (
          <Button
            onClick={handleInstall}
            className="w-full h-14 rounded-full bg-charcoal text-white text-base font-semibold gap-2"
          >
            <Download className="h-5 w-5" />
            Install Flea
          </Button>
        )}

        {/* iOS instructions */}
        {isIOS && !deferredPrompt && (
          <div className="w-full bg-muted/50 rounded-2xl p-6 space-y-4">
            <h3 className="font-semibold text-foreground text-center">How to install on iPhone</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-sm font-bold">1</div>
                <p className="text-sm text-foreground pt-1">
                  Tap the <Share className="inline h-4 w-4 -mt-0.5" /> <strong>Share</strong> button in Safari's bottom bar
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-sm font-bold">2</div>
                <p className="text-sm text-foreground pt-1">
                  Scroll down and tap <Plus className="inline h-4 w-4 -mt-0.5" /> <strong>Add to Home Screen</strong>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-sm font-bold">3</div>
                <p className="text-sm text-foreground pt-1">
                  Tap <strong>Add</strong> — Flea will appear on your home screen!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Android fallback if prompt didn't fire */}
        {isAndroid && !deferredPrompt && (
          <div className="w-full bg-muted/50 rounded-2xl p-6 space-y-4">
            <h3 className="font-semibold text-foreground text-center">How to install on Android</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-sm font-bold">1</div>
                <p className="text-sm text-foreground pt-1">
                  Tap the <strong>⋮ menu</strong> in Chrome's top-right corner
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-sm font-bold">2</div>
                <p className="text-sm text-foreground pt-1">
                  Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Desktop fallback */}
        {!isIOS && !isAndroid && !deferredPrompt && (
          <div className="w-full bg-muted/50 rounded-2xl p-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Visit <strong>shop-flea.lovable.app</strong> on your phone to install the app.
            </p>
          </div>
        )}

        <div className="text-center space-y-1">
          <p className="text-xs text-muted-foreground">
            No app store download needed • Works offline • Push notifications
          </p>
        </div>
      </div>
    </div>
  );
};

export default Install;
