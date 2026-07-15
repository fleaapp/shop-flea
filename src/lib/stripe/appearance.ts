import type { Appearance } from '@stripe/stripe-js';

// Flea-branded appearance for Stripe Elements (matches our charcoal/lime tokens).
export const fleaAppearance: Appearance = {
  theme: 'stripe',
  variables: {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSizeBase: '15px',
    colorPrimary: '#1a1a1a',
    colorBackground: '#ffffff',
    colorText: '#1a1a1a',
    colorTextSecondary: '#6b6b6b',
    colorDanger: '#dc2626',
    borderRadius: '12px',
    spacingUnit: '4px',
  },
  rules: {
    '.Input': {
      border: '1px solid #e5e5e5',
      boxShadow: 'none',
      padding: '12px 14px',
    },
    '.Input:focus': {
      border: '1px solid #1a1a1a',
      boxShadow: 'none',
    },
    '.Label': {
      fontSize: '13px',
      fontWeight: '500',
      color: '#6b6b6b',
    },
    '.Tab': {
      border: '1px solid #e5e5e5',
      borderRadius: '12px',
    },
    '.Tab--selected': {
      border: '1.5px solid #1a1a1a',
    },
  },
};
