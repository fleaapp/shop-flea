# npm audit findings - assessment and action

## Verdict: safe to ship this TestFlight build

Lovable's own dependency scan of this project reports **no high or critical vulnerabilities**. The 16 entries `npm audit` printed on your Mac come from your locally regenerated `package-lock.json`, which resolves a slightly different set of transitive packages than the cloud lockfile.

## Why the count jumped

Nothing in Flea's app code became less secure. Two causes:

1. The pull rewrote `package-lock.json` (348 changed lines), so `npm install` pulled fresh transitive versions and npm re-evaluated them against today's advisory database.
2. Several of these advisories (node-tar, brace-expansion, postcss, @babel/core) were published very recently and now match versions that were considered clean a week ago.

## Every flagged package is build-time only

| Package | Where it runs |
| --- | --- |
| `tar` (critical) | npm/Capacitor CLI package extraction on your Mac |
| `@babel/core`, `postcss`, `yaml`, `brace-expansion` | Vite/Tailwind build toolchain |
| `@xmldom/xmldom` | Capacitor CLI reading iOS/Android XML config |

None of these are bundled into `dist/`, so none reach the iOS app users install. They are only exploitable if you deliberately feed a malicious archive or stylesheet into your own local build.

## The one runtime package, and why it does not apply

`react-router-dom` 7.18.1 is flagged for **GHSA-qwww-vcr4-c8h2 - RSC Mode CSRF Bypass**. That advisory only affects React Server Components mode. Flea is a client-side SPA with no RSC server, so the vulnerable code path does not exist in this app.

## Recommended action now

Proceed with the archive. Do **not** run `npm audit fix` before this build - it can bump build-tool majors and produce a different bundle than the one already verified.

## Optional follow-up after launch

Bump `react-router-dom` to the latest 7.x patch and let the build toolchain pick up patched `postcss` / `tar` on a routine dependency refresh, then re-run the build and the archive checks. This is housekeeping, not a launch blocker.
