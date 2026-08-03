## Make the error log readable, and cover what's missing

### What's actually being logged today (verified against the live log table)

Logged from the app (`src/lib/errorLogger.ts`):
- **Render crash (ErrorBoundary)** - the white "something went wrong" screen. 5 entries, e.g. `Minified React error #310`, `Can't find variable: anyStillClearing`.
- **Uncaught error** - any unhandled JavaScript failure. 6 entries.
- **Unhandled promise rejection** - a background request failed. 15 entries, mostly `Load failed` (network dropped) and `Importing a module script failed` (stale app version after a deploy).
- **Google sign-in failed / exception** (native + web) - `src/pages/Auth.tsx`.
- **Apple Pay diagnostics** - `src/lib/applePayDiagnostics.ts`.
- **Seller dashboard load failure** - `src/pages/SellerDashboard.tsx`.
- **Native push** - about 10 different messages (`setup-started`, `token-received`, `permission-checked`...). These are step-by-step traces, not errors, and are the single largest group in the table (63 of 95 rows).

Logged from the backend (only 5 of ~50 functions use `logEdgeError`):
- `add-listing-comment`, `push-status`, `register-push-subscription`, `send-push-notification`, `stripe-connect-payout`.

### Problem 1 - the language is developer shorthand

Titles like "Unhandled promise rejection" and messages like `Minified React error #310` say nothing to a non-technical reader.

**Fix: a translation layer** - a new `src/lib/errorCatalog.ts` mapping known error signatures to plain English, used by the admin screen for display only (the raw text is still kept and shown under "Technical detail"). Examples:

| Raw | Shown instead |
|---|---|
| Unhandled promise rejection / `Load failed` | **Request failed - connection dropped** · "The app tried to reach the server and the connection dropped, usually poor signal or the user backgrounding the app." |
| `Importing a module script failed` | **Old app version - needs reload** · "The user was on an outdated build after a deploy. The app auto-reloads to fix this." |
| Render crash / `Minified React error #310` | **Screen crashed - broken code on this screen** · "React hooks error. The user saw the error screen and had to restart." |
| `Can't find variable: X` | **Screen crashed - missing code** |
| `Script error.` | **Crash with no detail (cross-origin script)** |
| Google sign-in failed | **Sign-in with Google didn't work** |

Anything not in the catalog falls back to the raw title, so nothing is ever hidden.

### Problem 2 - the screen itself reads technically

In `src/pages/admin/AdminErrorLogs.tsx`:
- Severity pills become **Critical → "App broke"**, **Error → "Something failed"**, **Warning → "Minor"**; source pills become **App**, **Backend**, **Payments**, **Sign-in**.
- Each row shows the plain-English title first, the human explanation as the second line, and a footer reading e.g. `@sarahhearn2 · on Checkout · iPhone · 3 times today` instead of a raw route path.
- Routes translate to screen names (`/checkout` → "Checkout", `/seller/:id` → "Seller profile").
- Detail drawer is reordered: **What happened → Who it affected → What to do next** (a suggested action per catalog entry), with Stack / Device / Context collapsed under "Technical detail" for developers.
- Group identical errors into one row with an occurrence count, instead of listing 8 copies.

### Problem 3 - noise and gaps

- **Stop logging the push trace steps.** `useNativePushNotifications.ts` sends ~10 informational events at `warning`; these dominate the table and hide real failures. Keep only genuine failures.
- **Add missing coverage.** These are the paths where a user loses money or a sale and we currently see nothing. Wrap each in `logEdgeError` / `logError`:
  - **Payments:** `stripe-connect-payment-intent`, `finalize-checkout`, `stripe-webhook`, `stripe-connect-refund`, `stripe-connect-topup`, `validate-coupon` → "Checkout failed for a buyer", "Refund could not be issued".
  - **Seller onboarding:** `stripe-connect-onboard`, `stripe-connect-status`, `stripe-connect-upload-id` → "Seller verification failed".
  - **Orders and messaging:** `order-messages`, `auto-refund-unshipped`, `shipping-reminders`, `auto-approve-refund-requests` → "Scheduled job failed" (silent cron failures are how the 8-day refund bug went unnoticed).
  - **Listings:** create/edit listing save failures, image upload failures.
  - **Account:** `delete-account`, `check-email-provider`, `resolve-oauth-conflict`.
- **Add a "Needs attention" section** at the top of the screen: anything payment, refund or sign-in related in the last 24 hours, since those are the ones that cost real money.

### Technical notes

- No database changes. `error_logs` already stores title, message, stack, route, device, context and `dedupe_key`; the catalog is a client-side display layer keyed off title + message.
- Grouping uses `dedupe_key` with a count, so the raw rows stay intact for deletion and export.
- Backend logging additions are the existing `logEdgeError` helper in catch blocks - non-blocking and never changes a function's response.
