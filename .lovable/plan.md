# Re-enable Google sign up / login

## What you need to do (the short version)

Nothing in the Google Cloud console, and nothing in Xcode. Google sign-in runs on Lovable Cloud's managed Google credentials, so there is no client ID, secret, or reversed URL scheme to copy anywhere. The only reason it was switched off was the old native Google plugin writing a placeholder URL scheme into `Info.plist`, which Apple rejected - that plugin stays removed.

Your steps:

1. Approve this plan.
2. I enable the managed Google provider on the backend and put the Google button back on the login and sign up tabs.
3. You test: tap the Google button on the Flea preview, pick an account, and confirm you land back in the app signed in.

The only thing you may want to copy later is nothing at all - if you ever decide you want Google's consent screen to show "Flea" instead of Lovable's default, that is a separate, optional branding job with your own Google Cloud client.

## How it stays in the app

The flow reuses exactly the same in-app path Apple sign-in already uses:

```text
Google button
  -> Supabase builds the OAuth URL (skipBrowserRedirect: true)
  -> opened in the in-app browser sheet (openInAppUrl)
  -> Google account picker inside that sheet
  -> redirect to https://app.finditonflea.com/auth/callback
  -> universal link hands control straight back to Flea
  -> sheet closes, onAuthStateChange signs the user in
```

No Safari bounce, no custom URL scheme, no deep link out of the app. On web/PWA the same button does a normal in-page OAuth redirect.

## What I will build

- Enable the managed Google provider for this project's backend (keeps email and Apple enabled).
- Restore the Google button in `src/pages/Auth.tsx` next to the Apple button, using the existing lime/charcoal social button styling and a Google glyph, with an `aria-label` for accessibility. It sits under "Or login with" / "Or sign up with" on both tabs.
- Keep `handleGoogleSignIn` as-is (it already handles `prompt: select_account`, error toasts, and `flea_oauth_signup` for the password-setup step) and let it fall through to the web OAuth path, which is the in-app browser path on native.
- Leave `src/lib/googleSignIn.ts` returning `handled: false` so no native Google plugin is reintroduced and `Info.plist` is untouched - your Apple archive stays clean.
- Confirm the existing duplicate-account guard (`check-email-provider` / `ProviderConflictDialog`) still fires when someone who signed up with email tries Google with the same address.

## Technical notes

- Files touched: `src/pages/Auth.tsx` only.
- Backend: managed Google provider enabled via the social auth configuration tool in the same step, so the first tap does not error with "Unsupported provider".
- Redirect target stays `getSignupRedirectUrl()` -> `https://app.finditonflea.com/auth/callback`, already in the allow-list and already covered by the universal-link handler in `authRedirects.ts`.
- No new packages, no Capacitor sync, no Xcode change needed.
