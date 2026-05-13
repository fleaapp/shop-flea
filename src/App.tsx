import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import { OnboardingProvider, useOnboarding } from "@/context/OnboardingContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import OnboardingOverlay from "@/components/OnboardingOverlay";
import OnboardingCarousel from "@/components/OnboardingCarousel";
import RealtimeAlerts from "./components/RealtimeAlerts";
import { PushNotificationSubscriber } from "./components/PushNotificationSubscriber";
import ErrorBoundary from "./components/ErrorBoundary";
import PageSkeleton from "./components/PageSkeleton";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";

// Critical path – loaded eagerly
import Index from "./pages/Index";
import Auth from "./pages/Auth";

const loadListingDetails = () => import("./pages/ListingDetails");
const loadFavorites = () => import("./pages/Favorites");
const loadCart = () => import("./pages/Cart");
const loadCheckout = () => import("./pages/Checkout");
const loadCheckoutSuccess = () => import("./pages/CheckoutSuccess");
const loadProfile = () => import("./pages/Profile");
const loadCreateListing = () => import("./pages/CreateListing");
const loadEditListing = () => import("./pages/EditListing");
const loadEditProfile = () => import("./pages/EditProfile");
const loadNotifications = () => import("./pages/Notifications");
const loadSettings = () => import("./pages/Settings");
const loadContactSupport = () => import("./pages/ContactSupport");
const loadChatConversation = () => import("./pages/ChatConversation");
const loadSellerProfile = () => import("./pages/SellerProfile");
const loadFAQ = () => import("./pages/FAQ");
const loadOrderChat = () => import("./pages/OrderChat");
const loadSales = () => import("./pages/Sales");
const loadAbout = () => import("./pages/About");
const loadInstall = () => import("./pages/Install");
const loadSuggestionBox = () => import("./pages/SuggestionBox");
const loadForgotPassword = () => import("./pages/ForgotPassword");
const loadResetPassword = () => import("./pages/ResetPassword");
const loadVerifyEmail = () => import("./pages/VerifyEmail");
const loadNotFound = () => import("./pages/NotFound");
const loadTerms = () => import("./pages/Terms");
const loadPrivacyPolicy = () => import("./pages/PrivacyPolicy");
const loadAdminDashboard = () => import("./pages/admin/AdminDashboard");
const loadAdminTransactions = () => import("./pages/admin/AdminTransactions");
const loadAdminUsers = () => import("./pages/admin/AdminUsers");
const loadAdminListings = () => import("./pages/admin/AdminListings");
const loadAdminErrors = () => import("./pages/admin/AdminErrors");

const ListingDetails = lazy(loadListingDetails);
const Favorites = lazy(loadFavorites);
const Cart = lazy(loadCart);
const Checkout = lazy(loadCheckout);
const CheckoutSuccess = lazy(loadCheckoutSuccess);
const Profile = lazy(loadProfile);
const CreateListing = lazy(loadCreateListing);
const EditListing = lazy(loadEditListing);
const EditProfile = lazy(loadEditProfile);
const Notifications = lazy(loadNotifications);
const Settings = lazy(loadSettings);
const ContactSupport = lazy(loadContactSupport);
const ChatConversation = lazy(loadChatConversation);
const SellerProfile = lazy(loadSellerProfile);
const FAQ = lazy(loadFAQ);
const OrderChat = lazy(loadOrderChat);
const Sales = lazy(loadSales);
const About = lazy(loadAbout);
const Install = lazy(loadInstall);
const SuggestionBox = lazy(loadSuggestionBox);
const ForgotPassword = lazy(loadForgotPassword);
const ResetPassword = lazy(loadResetPassword);
const VerifyEmail = lazy(loadVerifyEmail);
const NotFound = lazy(loadNotFound);
const Terms = lazy(loadTerms);
const PrivacyPolicy = lazy(loadPrivacyPolicy);
const AdminDashboard = lazy(loadAdminDashboard);
const AdminTransactions = lazy(loadAdminTransactions);
const AdminUsers = lazy(loadAdminUsers);
const AdminListings = lazy(loadAdminListings);
const AdminErrors = lazy(loadAdminErrors);
import AdminRoute from "@/components/admin/AdminRoute";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      // Avoid 3x exponential-backoff retries on missing RPCs / columns which add seconds of latency
      retry: (failureCount, error: any) => {
        const code = error?.code ?? error?.status;
        if (code === 'PGRST202' || code === 'PGRST204' || code === '42703' || code === 404 || code === 400) {
          return false;
        }
        return failureCount < 1;
      },
    },
  },
});

const PageLoader = () => <PageSkeleton />;

type RgbaColor = { r: number; g: number; b: number; a: number };

const parseCssColor = (color: string): RgbaColor | null => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = color;
  const normalized = ctx.fillStyle;
  if (normalized.startsWith('#')) {
    const hex = normalized.length === 4
      ? normalized.slice(1).split('').map((v) => v + v).join('')
      : normalized.slice(1, 7);
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
      a: 1,
    };
  }
  const match = normalized.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) return null;
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: match[4] === undefined ? 1 : Number(match[4]),
  };
};

const composite = (top: RgbaColor, bottom: RgbaColor): RgbaColor => {
  const alpha = top.a + bottom.a * (1 - top.a);
  if (alpha <= 0) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: Math.round((top.r * top.a + bottom.r * bottom.a * (1 - top.a)) / alpha),
    g: Math.round((top.g * top.a + bottom.g * bottom.a * (1 - top.a)) / alpha),
    b: Math.round((top.b * top.a + bottom.b * bottom.a * (1 - top.a)) / alpha),
    a: alpha,
  };
};

const toHexColor = ({ r, g, b }: RgbaColor) => {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
};

const AppContent = () => {
  const { showCarousel, closeCarousel } = useOnboarding();
  const location = useLocation();
  const isStandaloneSite = location.pathname.startsWith('/about');

  useEffect(() => {
    const currentRoute = `${location.pathname}${location.search}${location.hash}`;
    if (!location.pathname.startsWith('/listing/')) {
      sessionStorage.setItem('flea_last_non_listing_route', currentRoute);
    }
  }, [location.pathname, location.search, location.hash]);

  // Keep iOS/PWA status bar (safe-area) color in sync with the actual top of the screen.
  // Sample the rendered background color a few pixels below the safe-area inset and apply
  // it to the html/body so the iOS notch / status bar matches whatever the user is seeing.
  useEffect(() => {
    let raf = 0;
    let cancelled = false;

    const ensureMeta = () => {
      let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        document.head.appendChild(meta);
      }
      return meta;
    };

    const getVisualBgAtPoint = (x: number, y: number, fallbackColor: string) => {
      let visual = parseCssColor(fallbackColor) || { r: 237, g: 232, b: 220, a: 1 };
      const elements = document.elementsFromPoint(x, y).reverse();

      for (const el of elements) {
        const color = parseCssColor(getComputedStyle(el).backgroundColor);
        if (!color || color.a <= 0) continue;
        visual = composite(color, visual);
        if (visual.a >= 0.995) {
          visual.a = 1;
        }
      }

      return visual;
    };

    const isLightColor = ({ r, g, b }: RgbaColor) => {
      const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      return luminance > 0.55;
    };

    const sync = () => {
      if (cancelled) return;
      const x = Math.floor(window.innerWidth / 2);
      const root = getComputedStyle(document.documentElement);
      const primary = `hsl(${root.getPropertyValue('--primary').trim()})`;
      const fallback = `hsl(${root.getPropertyValue('--background').trim()})`;
      const sampled = getVisualBgAtPoint(x, 4, location.pathname === '/auth' ? primary : fallback);
      const color = toHexColor(sampled);

      ensureMeta().setAttribute('content', color);
      document.documentElement.style.backgroundColor = color;
      document.body.style.backgroundColor = color;
      if (Capacitor.isNativePlatform()) {
        const isIos = Capacitor.getPlatform() === 'ios';
        void StatusBar.setOverlaysWebView({ overlay: isIos }).catch(() => undefined);
        void StatusBar.setStyle({ style: isLightColor(sampled) ? Style.Light : Style.Dark }).catch(() => undefined);
        if (!isIos) {
          void StatusBar.setBackgroundColor({ color }).catch(() => undefined);
        }
      }
    };

    // Wait one frame so the new route has rendered before we sample.
    raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(sync);
    });

    // Re-sync on resize (keyboard, rotation) and after DOM updates within the page.
    window.addEventListener('resize', sync);
    const observer = new MutationObserver(() => {
      // Throttle via rAF
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(sync);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', sync);
      observer.disconnect();
    };
  }, [location.pathname]);

  useEffect(() => {
    const prefetchCoreRoutes = () => {
      void loadFavorites();
      void loadCart();
      void loadProfile();
      void loadNotifications();
      void loadSettings();
      // Heavy/common destinations users tap from buttons — preload so navigation is instant
      void loadListingDetails();
      void loadCheckout();
      void loadCreateListing();
      void loadEditListing();
      void loadSellerProfile();
      void loadChatConversation();
      void loadOrderChat();
      void loadSales();
    };

    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(prefetchCoreRoutes, { timeout: 2000 });
      return;
    }

    const timeoutId = window.setTimeout(prefetchCoreRoutes, 1200);
    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <>
      <Toaster />
      <Sonner position="top-center" />
      {!isStandaloneSite && <RealtimeAlerts />}
      {!isStandaloneSite && <PushNotificationSubscriber />}
      {!isStandaloneSite && <OnboardingOverlay />}
      {!isStandaloneSite && <OnboardingCarousel open={showCarousel} onComplete={closeCarousel} />}
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/about" element={<About />} />
          <Route path="/install" element={<Install />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/listing/:id" element={<ProtectedRoute><ListingDetails /></ProtectedRoute>} />
          <Route path="/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
          <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
          <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
          <Route path="/checkout/success" element={<CheckoutSuccess />} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/create" element={<ProtectedRoute><CreateListing /></ProtectedRoute>} />
          <Route path="/listing/:id/edit" element={<ProtectedRoute><EditListing /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/settings/profile" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
          <Route path="/suggestion-box" element={<ProtectedRoute><SuggestionBox /></ProtectedRoute>} />
          <Route path="/faq" element={<ProtectedRoute><FAQ /></ProtectedRoute>} />
          <Route path="/contact-support" element={<ProtectedRoute><ContactSupport /></ProtectedRoute>} />
          <Route path="/contact-support/:threadId" element={<ProtectedRoute><ChatConversation /></ProtectedRoute>} />
          <Route path="/seller/:sellerId" element={<ProtectedRoute><SellerProfile /></ProtectedRoute>} />
          <Route path="/sales" element={<ProtectedRoute><Sales /></ProtectedRoute>} />
          <Route path="/order-chat/:orderId" element={<ProtectedRoute><OrderChat /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/admin/transactions" element={<AdminRoute><AdminTransactions /></AdminRoute>} />
          <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
          <Route path="/admin/listings" element={<AdminRoute><AdminListings /></AdminRoute>} />
          <Route path="/admin/errors" element={<AdminRoute><AdminErrors /></AdminRoute>} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <OnboardingProvider>
              <TooltipProvider>
                <AppContent />
              </TooltipProvider>
            </OnboardingProvider>
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;