// Preload images/assets for faster display
const preloadedImages = new Set<string>();

export const preloadImage = (src: string): Promise<void> => {
  if (!src || preloadedImages.has(src)) {
    return Promise.resolve();
  }

  preloadedImages.add(src); // Mark immediately to avoid duplicate requests

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve(); // Don't block on errors
    img.src = src;
  });
};

export const preloadImages = (sources: string[]): Promise<void> => {
  return Promise.all(sources.filter(Boolean).map(preloadImage)).then(() => {});
};

// ── Eagerly preload ALL local static assets on module load ──

// Logos
import fleaLogo from '@/assets/flea-logo.png';
import fleaLogoAuth from '@/assets/flea-logo-auth.jpeg';
import fleaLogoReceipt from '@/assets/flea-logo-receipt.jpeg';
import fleaLogoTransparent from '@/assets/flea-logo-transparent.png';
import fleaLogoWelcome from '@/assets/flea-logo-welcome.png';
import fleaLogoWelcomeHeader from '@/assets/flea-logo-welcome-header.png';
import stripeLogo from '@/assets/logo-stripe.jpeg';
import paypalLogo from '@/assets/logo-paypal.png';
import soldSticker from '@/assets/sold-sticker.png';
import orderSuccessReceipt from '@/assets/order-success-receipt.png';

// Onboarding
import tapToExpandGif from '@/assets/onboarding/tap-to-expand.gif';
import swipeLeftPass from '@/assets/onboarding/swipe-left-pass.svg';
import swipeUpCart from '@/assets/onboarding/swipe-up-cart.svg';
import swipeRightWishlist from '@/assets/onboarding/swipe-right-wishlist.svg';
import cartSwipeActionsGif from '@/assets/onboarding/cart-swipe-actions.gif';

// Listing showcase images
import listingBag from '@/assets/listing-bag.jpg';
import listingJacket from '@/assets/listing-jacket.jpg';
import listingSneakers from '@/assets/listing-sneakers.jpg';
import listingSweater from '@/assets/listing-sweater.jpg';

const staticAssets = [
  fleaLogo,
  fleaLogoAuth,
  fleaLogoReceipt,
  fleaLogoTransparent,
  fleaLogoWelcome,
  fleaLogoWelcomeHeader,
  stripeLogo,
  paypalLogo,
  soldSticker,
  orderSuccessReceipt,
  tapToExpandGif,
  swipeLeftPass,
  swipeUpCart,
  swipeRightWishlist,
  cartSwipeActionsGif,
  listingBag,
  listingJacket,
  listingSneakers,
  listingSweater,
];

// Default avatars - import from their source directly
import avatarButton from '@/assets/avatars/button.png';
import avatar8ball from '@/assets/avatars/8ball.png';
import avatarCd from '@/assets/avatars/cd.png';
import avatarVinyl from '@/assets/avatars/vinyl.png';
import avatarBowling from '@/assets/avatars/bowling.png';
import avatarWatch from '@/assets/avatars/watch.png';
import avatarPokerChip from '@/assets/avatars/poker-chip.png';
import avatarPearl from '@/assets/avatars/pearl.png';
import avatarMarble from '@/assets/avatars/marble.png';
import avatarDiscoBall from '@/assets/avatars/disco-ball.png';
import avatarCoin from '@/assets/avatars/coin.png';
import avatarDartboard from '@/assets/avatars/dartboard.png';
import avatarPlate from '@/assets/avatars/plate.png';
import avatarGolfBall from '@/assets/avatars/golf-ball.png';

const avatarAssets = [
  avatarButton, avatar8ball, avatarCd, avatarVinyl, avatarBowling,
  avatarWatch, avatarPokerChip, avatarPearl, avatarMarble, avatarDiscoBall,
  avatarCoin, avatarDartboard, avatarPlate, avatarGolfBall,
];

// Fire-and-forget preload all static assets
preloadImages([...staticAssets, ...avatarAssets]);
