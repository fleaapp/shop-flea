## What the "critical" crashes actually are

All four of the most-recent `critical` rows in `error_logs` are the same thing:

- **Title:** `Render crash (ErrorBoundary)`
- **Message:** `Importing a module script failed.`
- **Component stack:** `Lazy → Suspense → TooltipProvider → …` (i.e. a `React.lazy(() => import(...))` boundary)
- **Assets referenced:** old hashed bundles like `/assets/index-DvUA0Wa2.js`, `index-CddW-kuG.js`, `index-Bbd3fmvO.js` that no longer exist on the CDN.

This is **not** a real render bug. It's the classic "stale deploy" pattern:

1. User has the app open (or comes back to a cached HTML) pointing at an old bundle hash.
2. They navigate to a route whose chunk is loaded lazily (`React.lazy`).
3. That chunk's URL 404s because a redeploy replaced it with a new hash → dynamic `import()` rejects with `Importing a module script failed.`
4. Suspense propagates the rejection, `ErrorBoundary` catches it, `componentDidCatch` logs it as **critical**, and the user sees the "Something went wrong" screen until they hit "Try again".

Evidence it's stale-chunk, not a code bug:
- `src/lib/errorLogger.ts` already filters this exact message out of the global `window.error` handler (`/Importing a module script failed/i.test(message)`), which is why only the ErrorBoundary path is logging it.
- All rows are `Lazy → Suspense` frames; none point at app code.
- Each row shows a different old bundle hash, and the ones with `__lovable_sha=…` in the route are old preview loads from before a redeploy.
- @sarahhearn2's `/seller-dashboard` row hit the same thing on the production domain right after a deploy.

So: benign, but noisy (marked critical) and user-visible (the crash screen instead of a silent refresh).

## Plan

1. **`src/components/ErrorBoundary.tsx`** – detect the stale-chunk case in `componentDidCatch`:
   - If `error.message` matches `/Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|ChunkLoadError/i`:
     - Do **not** call `logError` (matches the existing filter in `errorLogger.ts`).
     - Set a `sessionStorage` guard key (`flea:chunk-reload`) so we only auto-reload once per session, then `window.location.reload()` — the user sees a brief blank instead of the red error screen.
     - If the guard is already set (i.e. reload already tried this session), fall through to the normal error UI so we don't infinite-loop.
   - All other errors keep logging as `critical` exactly as today.

2. **`src/main.tsx` (or wherever the router is set up)** – add a lightweight `unhandledrejection` guard that catches the same message class and calls the same one-shot reload helper, so a stale chunk failing outside a Suspense boundary (e.g. a route-level `import()` triggered by a click) is also recovered silently.

3. Extract the match + one-shot reload into a tiny helper (`src/lib/staleChunkRecovery.ts`) so ErrorBoundary and the global handler share it.

4. No schema, edge-function, or backend changes. No changes to what real render bugs report — they'll still land in `error_logs` as `critical`.

## Cleanup (optional, ask before doing)

The existing four rows are still labeled `critical` in `error_logs`. I can either leave them (they'll age out on their own) or run a one-off update to mark historical `Importing a module script failed.` rows as `warning` so the admin dashboard critical count reflects reality. Say the word and I'll add that as a step.
