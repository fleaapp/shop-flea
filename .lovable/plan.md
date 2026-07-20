The install is failing because the repo currently asks npm to install `@stripe/stripe-js@8.11.0`, but `@stripe/react-stripe-js@3.10.0` only allows `@stripe/stripe-js` below v8. Since `npm install` fails, `vite` never gets installed, which is why the later `npm run build` says `vite: command not found`.

Plan:
1. Update `package.json` so Stripe packages use a compatible version set.
   - Keep `@stripe/react-stripe-js` on the current v3 line.
   - Downgrade `@stripe/stripe-js` from `^8.11.0` to a compatible v7 release.
   - Leave the Capacitor Stripe plugin and Stripe Connect packages alone unless they also show a peer conflict.
2. Recreate the lockfile from the corrected dependency tree.
3. Verify the install/build path succeeds in the sandbox.
4. Give you the exact clean local command to run after pulling the fix.

After this, your local sequence should work again without `--force` or `--legacy-peer-deps`.