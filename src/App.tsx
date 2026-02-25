import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import { OnboardingProvider } from "@/context/OnboardingContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import OnboardingOverlay from "@/components/OnboardingOverlay";
import SuggestionBox from "./pages/SuggestionBox";
import Index from "./pages/Index";
import ListingDetails from "./pages/ListingDetails";
import Favorites from "./pages/Favorites";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import CheckoutSuccess from "./pages/CheckoutSuccess";
import Profile from "./pages/Profile";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import CreateListing from "./pages/CreateListing";
import EditListing from "./pages/EditListing";
import EditProfile from "./pages/EditProfile";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import ContactSupport from "./pages/ContactSupport";
import ChatConversation from "./pages/ChatConversation";
import NotFound from "./pages/NotFound";
import SellerProfile from "./pages/SellerProfile";
import FAQ from "./pages/FAQ";
import OrderChat from "./pages/OrderChat";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <OnboardingProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner position="top-center" />
              <OnboardingOverlay />
              <Routes>
              <Route path="/auth" element={<Auth />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                <Route path="/listing/:id" element={<ProtectedRoute><ListingDetails /></ProtectedRoute>} />
                <Route path="/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
                <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
                <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
                <Route path="/checkout/success" element={<ProtectedRoute><CheckoutSuccess /></ProtectedRoute>} />
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
                <Route path="/order-chat/:orderId" element={<ProtectedRoute><OrderChat /></ProtectedRoute>} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </TooltipProvider>
          </OnboardingProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
