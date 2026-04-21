import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import { OnboardingProvider, useOnboarding } from "@/context/OnboardingContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import OnboardingOverlay from "@/components/OnboardingOverlay";
import OnboardingCarousel from "@/components/OnboardingCarousel";
import RealtimeAlerts from "./components/RealtimeAlerts";
import { PushNotificationSubscriber } from "./components/PushNotificationSubscriber";

// Critical path – loaded eagerly
import Index from "./pages/Index";
import Auth from "./pages/Auth";

// Everything else – lazy loaded
const ListingDetails = lazy(() => import("./pages/ListingDetails"));
const Favorites = lazy(() => import("./pages/Favorites"));
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const CheckoutSuccess = lazy(() => import("./pages/CheckoutSuccess"));
const Profile = lazy(() => import("./pages/Profile"));
const CreateListing = lazy(() => import("./pages/CreateListing"));
const EditListing = lazy(() => import("./pages/EditListing"));
const EditProfile = lazy(() => import("./pages/EditProfile"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Settings = lazy(() => import("./pages/Settings"));
const ContactSupport = lazy(() => import("./pages/ContactSupport"));
const ChatConversation = lazy(() => import("./pages/ChatConversation"));
const SellerProfile = lazy(() => import("./pages/SellerProfile"));
const FAQ = lazy(() => import("./pages/FAQ"));
const OrderChat = lazy(() => import("./pages/OrderChat"));
const Sales = lazy(() => import("./pages/Sales"));
const About = lazy(() => import("./pages/About"));
const Install = lazy(() => import("./pages/Install"));
const SuggestionBox = lazy(() => import("./pages/SuggestionBox"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background">
    <span className="text-4xl animate-pulse">⏳</span>
  </div>
);

const AppContent = () => {
  const { showCarousel, closeCarousel } = useOnboarding();
  return (
    <>
      <Toaster />
      <Sonner position="top-center" />
      <RealtimeAlerts />
      <PushNotificationSubscriber />
      <OnboardingOverlay />
      <OnboardingCarousel open={showCarousel} onComplete={closeCarousel} />
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
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
};

const App = () => (
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
);

export default App;