export type OnboardingStepKey =
  | 'swipe-navigation'
  | 'tap-to-expand'
  | 'undo-action'
  | 'nav-home'
  | 'nav-cart'
  | 'nav-favorites'
  | 'nav-profile'
  | 'nav-notifications'
  | 'nav-settings';

export interface StepConfig {
  targetId: string;
  fallbackTargetId?: string;
  title: string;
  description: string;
  route: string;
  gesture?: 'swipe-left-right' | 'swipe-up' | 'tap' | 'swipe-left';
  labelPosition: 'top' | 'bottom';
}

export const ONBOARDING_STEPS: Record<OnboardingStepKey, StepConfig> = {
  'swipe-navigation': {
    targetId: 'swipe-card-stack',
    title: 'Swipe to Browse',
    description: 'Swipe left to pass, right to save to wishlist, or up to add to cart',
    route: '/',
    gesture: 'swipe-left-right',
    labelPosition: 'bottom',
  },
  'tap-to-expand': {
    targetId: 'swipe-card-stack',
    title: 'Tap to View',
    description: 'Tap any card to see full item details',
    route: '/',
    gesture: 'tap',
    labelPosition: 'bottom',
  },
  'undo-action': {
    targetId: 'undo-button',
    title: 'Undo Actions',
    description: 'Made a mistake? Tap here to undo your last swipe',
    route: '/',
    labelPosition: 'top',
  },
  'nav-home': {
    targetId: 'nav-home',
    title: 'Home Feed',
    description: 'Return to browsing items anytime',
    route: '/',
    labelPosition: 'top',
  },
  'nav-cart': {
    targetId: 'nav-cart',
    title: 'Your Cart',
    description: 'View items you swiped up to buy. Swipe left on items to remove or move to wishlist',
    route: '/cart',
    gesture: 'swipe-left',
    labelPosition: 'top',
  },
  'nav-favorites': {
    targetId: 'nav-favorites',
    title: 'Your Wishlist',
    description: 'Find all the items you saved by swiping right',
    route: '/favorites',
    labelPosition: 'top',
  },
  'nav-profile': {
    targetId: 'nav-profile',
    title: 'Your Profile',
    description: 'Manage your listings, orders, and sales here',
    route: '/profile',
    labelPosition: 'top',
  },
  'nav-notifications': {
    targetId: 'nav-alerts',
    title: 'Notifications',
    description: 'Stay updated on orders, messages, and activity',
    route: '/notifications',
    labelPosition: 'top',
  },
  'nav-settings': {
    targetId: 'nav-settings',
    title: 'Settings',
    description: 'Customize your preferences and account settings',
    route: '/settings',
    labelPosition: 'top',
  },
};

export const STEP_ORDER: OnboardingStepKey[] = [
  'swipe-navigation',
  'tap-to-expand',
  'undo-action',
  'nav-home',
  'nav-cart',
  'nav-favorites',
  'nav-profile',
  'nav-notifications',
  'nav-settings',
];
