# Fix "Error 400: redirect_uri_mismatch" on Google sign-in

## What the error means

This one is coming from Google, not from our code. Sign-in now goes straight to the app's own auth endpoint (that was the change that removed the "Lovable" hop). Google only lets an OAuth client return to redirect URLs that are listed on that client. Your Flea OAuth client in Google Cloud still lists the old broker callback, so Google rejects the new one before showing the account picker.

Nothing in the app is broken - the allow-list in Google Cloud just needs the app's callback URL added.

## Fix (one setting, done by you)

1. Open the backend Users -> Auth Settings -> Sign In Methods -> Google section. Expand it and copy the **Callback URL** shown there.
2. In Google Cloud Console -> APIs & Services -> Credentials, open the Flea Web application OAuth client.
3. Under **Authorised redirect URIs**, add that exact callback URL (keep any existing entries).
4. Under **Authorised JavaScript origins**, make sure `https://app.finditonflea.com` is listed.
5. Save. Google can take a few minutes to propagate, then retry sign-in.

## If you'd rather not touch Google Cloud

I can switch the Google button back to the managed broker, which works immediately with no console changes - the trade-off is the brief "lovable" address showing in the sheet before Google loads. Say the word and I'll do that instead.

## What I'll do in the app

- Nothing is required if the redirect URI is added. If you want a safety net, I can add a friendlier error message so a `redirect_uri_mismatch` shows "Google sign-in isn't configured yet - try Apple or email" instead of the raw Google page being the last thing the user sees.

## Technical notes

- Files that would change only for the friendlier error: `src/pages/Auth.tsx`.
- No database or edge function changes.
