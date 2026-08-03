// Plain-English translation layer for the admin error log.
// Display only - the raw title/message/stack are always preserved on the row
// and shown under "Technical detail".

export type PlainError = {
  /** Short, human title shown as the headline of the row. */
  headline: string;
  /** One or two sentences a non-technical reader can act on. */
  explanation: string;
  /** What the admin should do about it. */
  action: string;
  /** Rough impact grouping used for the "Needs attention" section. */
  impact: 'money' | 'access' | 'app' | 'minor';
};

type Rule = {
  /** Matched against `${title} ${message}` (case-insensitive). */
  test: RegExp;
  plain: PlainError;
};

const RULES: Rule[] = [
  // ---------- Money / payments ----------
  {
    test: /(checkout|payment[- ]intent|finalize-checkout|stripe-webhook)/i,
    plain: {
      headline: 'A buyer could not complete checkout',
      explanation:
        'Something failed while taking payment for an order, so the buyer may have been charged nothing or seen an error at the last step.',
      action: 'Check the buyer\'s cart and the payment provider for a matching attempt before contacting them.',
      impact: 'money',
    },
  },
  {
    test: /refund/i,
    plain: {
      headline: 'A refund could not be issued',
      explanation: 'The app tried to send money back to a buyer and the payment provider rejected it.',
      action: 'Open the order and retry the refund. If it fails again the charge may already be reversed.',
      impact: 'money',
    },
  },
  {
    test: /payout|top-?up|balance/i,
    plain: {
      headline: 'A seller payout failed',
      explanation: 'A seller tried to move their available balance to their bank and the transfer did not go through.',
      action: 'Check the seller has finished verification and has a bank account attached.',
      impact: 'money',
    },
  },
  {
    test: /coupon/i,
    plain: {
      headline: 'A discount code did not apply',
      explanation: 'A buyer entered a coupon code and the app could not confirm whether it was valid.',
      action: 'Check the code is still active and has redemptions left.',
      impact: 'money',
    },
  },
  {
    test: /(onboard|verification|upload-id|connect-status)/i,
    plain: {
      headline: 'Seller verification hit a problem',
      explanation: 'A seller was setting up payments or uploading their ID and the step did not complete.',
      action: 'Ask the seller to reopen seller setup - progress is saved and they can resume.',
      impact: 'money',
    },
  },

  // ---------- Sign in / access ----------
  {
    test: /google sign-?in/i,
    plain: {
      headline: 'Sign in with Google did not work',
      explanation: 'A user tapped "Continue with Google" and was not signed in.',
      action: 'Usually the user cancelled. If it repeats for many users, the Google provider config needs a look.',
      impact: 'access',
    },
  },
  {
    test: /(unauthorized|not authenticated|bad_?jwt|invalid token|401)/i,
    plain: {
      headline: 'A user was signed out unexpectedly',
      explanation: 'The user\'s login session expired or was rejected, so the app treated them as logged out.',
      action: 'Harmless if occasional. If it spikes, sessions are being invalidated somewhere.',
      impact: 'access',
    },
  },
  {
    test: /apple pay/i,
    plain: {
      headline: 'Apple Pay was unavailable',
      explanation: 'The Apple Pay sheet could not open on this device, so the buyer had to pay by card instead.',
      action: 'Check the device actually has a card in Wallet before treating it as a bug.',
      impact: 'money',
    },
  },
  {
    test: /push/i,
    plain: {
      headline: 'Push notifications could not be set up',
      explanation: 'This device could not register for notifications, so the user will not get alerts on their phone.',
      action: 'Ask the user to check notification permissions in their phone settings.',
      impact: 'minor',
    },
  },

  // ---------- App crashes ----------
  {
    test: /importing a module script failed|dynamically imported module|chunkloaderror/i,
    plain: {
      headline: 'User was on an old version of the app',
      explanation:
        'We released an update while this person had the app open, so a piece of the old version was missing.',
      action: 'No action needed - the app reloads itself automatically when this happens.',
      impact: 'minor',
    },
  },
  {
    test: /can'?t find variable|is not defined|is not a function|undefined is not an object|cannot read propert/i,
    plain: {
      headline: 'A screen crashed - broken code',
      explanation:
        'The screen tried to use something that does not exist, so the user saw the error page and had to restart.',
      action: 'This is a real bug and needs a code fix. The technical detail below points at the screen.',
      impact: 'app',
    },
  },
  {
    test: /minified react error #(310|300|301|31)/i,
    plain: {
      headline: 'A screen crashed while loading',
      explanation:
        'An internal rendering rule was broken on this screen, so it showed the error page instead of the content.',
      action: 'Needs a code fix on the screen listed below.',
      impact: 'app',
    },
  },
  {
    test: /render crash|errorboundary/i,
    plain: {
      headline: 'A screen crashed',
      explanation: 'The user saw the "Something went wrong" screen and had to restart or reload.',
      action: 'Check how many users hit this - repeated crashes on one screen need a fix.',
      impact: 'app',
    },
  },
  {
    test: /^script error\.?$/i,
    plain: {
      headline: 'Crash with no detail',
      explanation:
        'Something failed inside code loaded from another provider, so the browser hid the details for security reasons.',
      action: 'Not actionable on its own. Only worry if the count is high.',
      impact: 'minor',
    },
  },

  // ---------- Network ----------
  {
    test: /load failed|failed to fetch|network ?error|networkerror|timeout|aborted/i,
    plain: {
      headline: 'The connection dropped',
      explanation:
        'The app tried to reach the server and the connection failed - usually poor signal, or the user locked their phone mid-request.',
      action: 'Normal in small numbers. A sudden spike means the backend was down.',
      impact: 'minor',
    },
  },
  {
    test: /unhandled promise rejection/i,
    plain: {
      headline: 'A background request failed',
      explanation: 'Something loading quietly in the background failed. The user may have seen missing content.',
      action: 'Check the technical detail for which request failed.',
      impact: 'app',
    },
  },
  {
    test: /permission denied|row-?level security|rls|403/i,
    plain: {
      headline: 'Blocked by a permission rule',
      explanation: 'The app tried to read or save data the user is not allowed to touch.',
      action: 'Either the user did something unusual, or a permission rule is too strict.',
      impact: 'app',
    },
  },
  {
    test: /does not exist|column .* of relation|42703|pgrst/i,
    plain: {
      headline: 'The database rejected a request',
      explanation: 'The app asked for data in a shape the database does not have. This is always a bug.',
      action: 'Needs a code or database fix.',
      impact: 'app',
    },
  },
  {
    test: /(cron|scheduled|auto-refund|auto-approve|reminder)/i,
    plain: {
      headline: 'A scheduled job failed',
      explanation:
        'One of the automatic background jobs (late-shipment refunds, reminders, auto-approvals) did not finish its run.',
      action: 'Important - if this repeats, automatic refunds and reminders stop happening silently.',
      impact: 'money',
    },
  },
];

const FALLBACK_BY_SEVERITY: Record<string, PlainError> = {
  critical: {
    headline: 'The app broke for this user',
    explanation: 'Something failed badly enough that the user could not keep using the screen they were on.',
    action: 'Read the technical detail below - this one needs a fix.',
    impact: 'app',
  },
  error: {
    headline: 'Something failed',
    explanation: 'An action did not complete. The user may have seen an error message or nothing at all.',
    action: 'Read the technical detail below to see which part failed.',
    impact: 'app',
  },
  warning: {
    headline: 'Minor issue',
    explanation: 'Something did not go to plan, but the user could keep going.',
    action: 'No action needed unless this happens a lot.',
    impact: 'minor',
  },
};

export function explainError(input: {
  title: string;
  message: string;
  severity: string;
  source?: string;
}): PlainError {
  const haystack = `${input.title || ''} ${input.message || ''}`;
  for (const rule of RULES) {
    if (rule.test.test(haystack)) return rule.plain;
  }
  return FALLBACK_BY_SEVERITY[input.severity] ?? FALLBACK_BY_SEVERITY.error;
}

/** Human label for a severity value. */
export const SEVERITY_LABEL: Record<string, string> = {
  critical: 'App broke',
  error: 'Something failed',
  warning: 'Minor',
};

/** Human label for where the error came from. */
export const SOURCE_LABEL: Record<string, string> = {
  client: 'App',
  edge_function: 'Backend',
  payment: 'Payments',
  auth: 'Sign in',
};

const ROUTE_NAMES: { test: RegExp; name: string }[] = [
  { test: /^\/$|^\/index/, name: 'Home' },
  { test: /^\/auth/, name: 'Sign in' },
  { test: /^\/checkout/, name: 'Checkout' },
  { test: /^\/cart/, name: 'Cart' },
  { test: /^\/wishlist/, name: 'Wishlist' },
  { test: /^\/orders/, name: 'Orders' },
  { test: /^\/sales/, name: 'Sales' },
  { test: /^\/seller-dashboard/, name: 'Seller dashboard' },
  { test: /^\/seller\//, name: 'Seller profile' },
  { test: /^\/profile/, name: 'Profile' },
  { test: /^\/settings/, name: 'Settings' },
  { test: /^\/listing\//, name: 'Listing details' },
  { test: /^\/create-listing|^\/sell/, name: 'New listing' },
  { test: /^\/notifications|^\/alerts/, name: 'Alerts' },
  { test: /^\/messages|^\/chat/, name: 'Messages' },
  { test: /^\/search/, name: 'Search' },
  { test: /^\/admin/, name: 'Admin' },
  { test: /^\/help|^\/support|^\/faq/, name: 'Help centre' },
];

/** Turn a raw route or edge-function path into a screen name a human recognises. */
export function friendlyRoute(route?: string | null): string | null {
  if (!route) return null;
  const path = route.split('?')[0];
  for (const r of ROUTE_NAMES) {
    if (r.test.test(path)) return r.name;
  }
  // Edge functions come through as "/function-name".
  const slug = path.replace(/^\//, '');
  if (!slug) return null;
  return slug.replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

/** Short device description from the stored device blob. */
export function friendlyDevice(device?: Record<string, any> | null): string | null {
  if (!device) return null;
  const ua = String(device.user_agent || '');
  if (/iphone/i.test(ua)) return 'iPhone';
  if (/ipad/i.test(ua)) return 'iPad';
  if (/android/i.test(ua)) return 'Android';
  if (/mac os/i.test(ua)) return 'Mac';
  if (/windows/i.test(ua)) return 'Windows';
  return device.platform ? String(device.platform) : null;
}
