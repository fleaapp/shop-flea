# Fix "no current job" when running the build command

## Diagnosis

The app code and build scripts are fine. The command failed because of how it was typed into the Mac terminal.

The user's terminal was given:

```text
% git pull && npm run ios:archive-ready
```

The leading `%` is the zsh prompt symbol, not part of the command. In zsh, a command starting with `%` is a job-control reference (`%` = "the current job"). Since no background job exists, zsh replies:

```text
zsh: no current job
```

and nothing runs. No git pull, no build. This matches exactly what the user saw, and it explains why "it's how I've always done it" - previous runbooks included `%` as the prompt marker and it happened to be pasted in this time.

## Fix for the user (no code change needed)

Run the command **without** the leading `%`:

```text
git pull && npm run ios:archive-ready
```

## Small repo hardening (optional, included)

1. Add a short note to `TESTFLIGHT.md` troubleshooting section:
   "If the terminal replies `zsh: no current job`, you copied the `%` prompt symbol. Re-run the command without it."
2. Same one-liner in `README-IOS.md` next to the cheatsheet block, since that file also shows commands.

No app, script, or config changes are required - the build pipeline itself is working.

## Verification

- Running `git pull && npm run ios:archive-ready` (no `%`) completes with the `SAFE TO ARCHIVE` message.
