export type OnboardingStepKey =
  | 'swipe-navigation'
  | 'tap-to-expand'
  | 'cart-wishlist'
  | 'cart-swipe-demo'
  | 'nav-profile'
  | 'nav-alerts'
  | 'nav-settings';

export interface StepConfig {
  targetId: string;
  fallbackTargetId?: string;
  title: string;
  description: string;
  route: string;
  gesture?: 'swipe-left-right' | 'swipe-up' | 'tap' | 'cart-swipe';
  labelPosition: 'top' | 'bottom';
}

export const ONBOARDING_STEPS: Record<OnboardingStepKey, StepConfig> = {
  'swipe-navigation': {
    targetId: 'swipe-card-stack',
    title: 'Swipe to Browse',
    description: 'Swipe left to pass, right to save, or up to add to cart',
    route: '/',
    gesture: 'swipe-left-right',
    labelPosition: 'bottom',
  },
  'tap-to-expand': {
    targetId: 'swipe-card-stack',
    title: 'Tap to View Details',
    description: 'Tap any card to see full item info',
    route: '/',
    gesture: 'tap',
    labelPosition: 'bottom',
  },
  'cart-wishlist': {
    targetId: 'cart-wishlist-button',
    title: 'Your Wishlist',
    description: 'Find all saved items here',
    route: '/cart',
    labelPosition: 'top',
  },
  'cart-swipe-demo': {
    targetId: 'cart-items-area',
    title: 'Manage Cart Items',
    description: 'Swipe right to delete, left to move to wishlist',
    route: '/cart',
    gesture: 'cart-swipe',
    labelPosition: 'top',
  },
  'nav-profile': {
    targetId: 'nav-profile',
    title: 'Your Profile',
    description: 'Manage listings, orders, and sales',
    route: '/profile',
    labelPosition: 'top',
  },
  'nav-alerts': {
    targetId: 'nav-alerts',
    title: 'Notifications',
    description: 'Stay updated on orders and activity',
    route: '/notifications',
    labelPosition: 'top',
  },
  'nav-settings': {
    targetId: 'nav-settings',
    title: 'Settings',
    description: 'Customize your preferences',
    route: '/settings',
    labelPosition: 'top',
  },
};

export const STEP_ORDER: OnboardingStepKey[] = [
  'swipe-navigation',
  'tap-to-expand',
  'cart-wishlist',
  'cart-swipe-demo',
  'nav-profile',
  'nav-alerts',
  'nav-settings',
];
