import { lazy, Suspense, useEffect, useLayoutEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
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
import { restoreRouteAppChrome } from "@/lib/appChrome";

// Critical path – loaded eagerly
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import DevicePreview from "./components/dev/DevicePreview";
import NetworkLogOverlay from "./components/dev/NetworkLogOverlay";

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
      retry: (failureCount, error: unknown) => {
        const queryError = error as { code?: string | number; status?: string | number } | null;
        const code = queryError?.code ?? queryError?.status;
        if (code === 'PGRST202' || code === 'PGRST204' || code === '42703' || code === 404 || code === 400) {
          return false;
        }
        return failureCount < 1;
      },
    },
  },
});

const PageLoader = () => <PageSkeleton />;

const AppContent = () => {
  const { showCarousel, closeCarousel } = useOnboarding();
  const location = useLocation();
  const isStandaloneSite = false;

  useEffect(() => {
    const currentRoute = `${location.pathname}${location.search}${location.hash}`;
    if (!location.pathname.startsWith("/listing/")) {
      sessionStorage.setItem("flea_last_non_listing_route", currentRoute);
    }
  }, [location.pathname, location.search, location.hash]);

  // Sync iOS/PWA safe-area strip with the current route background before paint.
  // Native resume/appStateChange listeners are registered ONCE inside
  // src/lib/appChrome.ts — do NOT register them here too (caused duplicate
  // App.addListener calls in Xcode and raced the Capacitor bridge during boot).
  useLayoutEffect(() => {
    restoreRouteAppChrome();
    const onVisibility = () => {
      if (!document.hidden) restoreRouteAppChrome();
    };
    window.addEventListener("pageshow", restoreRouteAppChrome);
    window.addEventListener("focus", restoreRouteAppChrome);
    window.addEventListener("popstate", restoreRouteAppChrome);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pageshow", restoreRouteAppChrome);
      window.removeEventListener("focus", restoreRouteAppChrome);
      window.removeEventListener("popstate", restoreRouteAppChrome);
      document.removeEventListener("visibilitychange", onVisibility);
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
          <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/about" element={<Navigate to="/" replace />} />
          <Route path="/install" element={<Install />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/app" element={<Navigate to="/" replace />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
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
      <DevicePreview />
      <NetworkLogOverlay />
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