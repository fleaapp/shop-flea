# Fix: TestFlight build boots to a blank lime screen

## What the green screen actually is

`index.html` paints `#DDFED7` before React mounts, on native when there is no stored session at the root path. So a plain lime screen with nothing on it means the boot paint worked and **React never mounted** - the JavaScript bundle failed during load.

## Confirmed cause in this build

Your build output printed, for the first time:

```text
Circular chunk: vendor -> vendor-react -> vendor
Circular chunk: vendor -> vendor-ui -> vendor
```

The `manualChunks` splitting in `vite.config.ts` puts everything else from `node_modules` into a catch-all `vendor` chunk while pulling React and the Radix/clsx group into separate chunks. Packages in `vendor` import from `vendor-react`/`vendor-ui`, and those chunks in turn import back into `vendor`. Rollup cannot order circular chunks, so on load one chunk evaluates before its dependency is initialised and throws a `Cannot access ... before initialization` style error at the very first line of app startup. Nothing renders; the lime boot paint stays on screen forever.

This did not show up in the Lovable preview because the dev server serves unbundled modules - the fault only exists in a production build, which is exactly what TestFlight ships.

## The fix

Remove the circularity by making the vendor split non-overlapping rather than catch-all-plus-exceptions:

1. In `vite.config.ts`, drop the trailing `return 'vendor'` catch-all so unmatched `node_modules` code stays in the entry chunk that already imports it, eliminating the back-edge into `vendor`.
2. Fold `class-variance-authority`, `clsx` and `tailwind-merge` out of `vendor-ui` - they are tiny and are imported by nearly every chunk, which is what creates the second cycle. Leave only `@radix-ui` and `@floating-ui` in `vendor-ui`.
3. Keep `vendor-react`, `vendor-motion`, `vendor-stripe`, `vendor-supabase` and `vendor-query` as-is - none of those create cycles.

## Guard so this cannot ship again

4. Extend `scripts/prepare-ios-archive.mjs` to capture the Vite build output and fail the archive if it contains `Circular chunk:`. A build that emits that warning must never reach Xcode.
5. Add a boot watchdog in `index.html`: if React has not mounted after roughly 8 seconds, replace the blank screen with a short "Couldn't start - tap to retry" message and log the underlying `window.onerror` value. This turns any future startup failure into something diagnosable instead of a silent green screen.

## How you will verify

- Run `npm run ios:archive-ready`. It must complete with no `Circular chunk:` line and print `SAFE TO ARCHIVE`.
- Archive and install. The auth screen should appear with the Google and Apple buttons and the native build label.

## Immediate workaround while this is being fixed

The currently installed TestFlight build is broken for everyone on it, so hold off distributing it further until the replacement build is up.
