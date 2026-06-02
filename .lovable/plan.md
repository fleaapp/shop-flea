## Enable Sign in with Apple

Two halves: uncomment the button in code, and configure Apple as an OAuth provider in your Supabase Auth dashboard. Both are required.

---

### Part A — Code change (Lovable handles this)

In `src/pages/Auth.tsx` lines 496–503, the Apple button is wrapped in a `{/* TODO: Re-enable when ready ... */}` comment. Uncomment the Apple button only, keep Facebook commented. Result: Google and Apple show side-by-side under "Or login with".

The handler at line 260 (`handleAppleSignIn`) already exists and is correct — it calls `supabase.auth.signInWithOAuth({ provider: 'apple' })`.

### Part B — Supabase Auth provider setup (you handle this in Supabase dashboard)

The button will fail until Apple is enabled in your external Supabase project's Auth → Providers settings. Here's how to set it up:

#### Step 1: Apple Developer Console prep
You need four things from https://developer.apple.com:

1. **Team ID** — top right of Apple Developer Console (10 chars, e.g. `ABCDE12345`)
2. **Services ID** — Identifiers → `+` → Services IDs
   - Description: "Flea Web Auth"
   - Identifier: `com.finditonflea.app.web` (must differ from your app's bundle ID)
   - Enable "Sign in with Apple" → Configure:
     - Primary App ID: your iOS app's bundle ID (`com.finditonflea.app`)
     - Domains: `<your-supabase-project-ref>.supabase.co`
     - Return URLs: `https://<your-supabase-project-ref>.supabase.co/auth/v1/callback`
3. **Key (.p8 file)** — Keys → `+`
   - Name: "Flea Sign In"
   - Enable "Sign in with Apple", select your primary App ID
   - Download the `.p8` file (you only get one chance) and note the **Key ID** (10 chars)
4. **Generate the Client Secret JWT** — Apple's "client secret" is actually a JWT signed with your .p8 key, valid up to 6 months. Easiest path: use the form in your Supabase dashboard (Auth → Providers → Apple → "Generate Secret") which takes Team ID, Key ID, Services ID, and the .p8 contents.

#### Step 2: Enable in Supabase
In your external Supabase project dashboard → Authentication → Providers → Apple:
- Toggle ON
- Client ID (for OAuth): your Services ID (e.g. `com.finditonflea.app.web`)
- Secret Key (for OAuth): the JWT generated above
- Save

#### Step 3: Test
- Reload the app, go to /auth
- Click the new Apple button
- You should be redirected to Apple's sign-in sheet, then back to your app authenticated

If you get "Unsupported provider: provider is not enabled", Apple isn't toggled on in Supabase. If you get "invalid_client", the Services ID or JWT is wrong.

---

### About the iOS native app

For the **iOS Capacitor app** (not web), you'll also need the **"Sign in with Apple" capability** added in Xcode → Signing & Capabilities. Native iOS uses Apple's local sign-in sheet (no browser redirect), which Capacitor's `@capacitor-community/apple-sign-in` plugin handles. That's a separate integration if you want native-quality Apple sign-in inside the iOS app — for App Store submission, the web-style OAuth redirect through Supabase is acceptable but not as smooth.

**Recommendation for first submission:** ship with the current web-style OAuth redirect (just uncomment the button + configure Supabase). This is what Google currently does too, and Apple's review team accepts it. Add the native plugin later as a polish update.

---

### Why I can't check Supabase for you

Your Supabase Auth provider settings live in your external Supabase dashboard, which Lovable's tools don't have direct access to read (we can only run migrations / read DB tables, not toggle Auth provider settings). You'll need to verify it manually in the dashboard, or paste a screenshot of Auth → Providers → Apple if you want me to sanity-check the values.

### What this plan does

- **In Lovable:** uncomment the Apple button in `src/pages/Auth.tsx` (Part A only)
- **You do in Supabase dashboard:** Part B (provider setup) — Lovable can't do this for you
- **You do in Xcode later (optional):** add native Apple sign-in plugin if you want a smoother iOS UX
