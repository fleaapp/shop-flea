# Fix local git conflict and prepare TestFlight archive

## Goal
Get the local `shop-flea` repo back in sync with `origin/main` so the new `ios:archive-ready` script is available, then run the archive pipeline.

## Steps

1. **Discard the local `package-lock.json` change**
   - This is safe if you did not manually edit dependencies. The file will be recreated by `npm install`.
   - Command:
     ```bash
     git checkout -- package-lock.json
     ```

2. **Complete the pull**
   - Command:
     ```bash
     git pull origin main
     ```

3. **Reinstall dependencies using the repo's lockfile**
   - Command:
     ```bash
     npm install
     ```

4. **Run the archive-ready pipeline**
   - Command:
     ```bash
     npm run ios:archive-ready
     ```
   - If `package.json` is still stale for any reason, use the shell fallback:
     ```bash
     bash scripts/archive-ready.sh
     ```

5. **Open Xcode and archive**
   - The script will finish by opening the workspace.
   - Use **Product → Archive** to build the TestFlight bundle.

## What to watch for
- If `git pull` reports other conflicting files besides `package-lock.json`, stop and review those before continuing.
- If the archive script reports `Google control: missing`, the web bundle did not copy correctly; do not archive until `present` is reported.
