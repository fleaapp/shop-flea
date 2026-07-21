## Plan

I will make this a preservation-only native repair. No icons, no splash files, and no `ios/` regeneration.

### 1. Remove icon/splash side effects from the native setup script
- Delete the section that copies app icons from old Xcode Archives.
- Delete the section that rewrites `AppIcon.appiconset/Contents.json`.
- Keep only safe items that matter for build/runtime: entitlements, required Info.plist keys, and verification output.
- Update the script wording so it never tells you to run `npx cap add ios` for an existing project.

### 2. Add a CapApp-SPM repair script
- Add a dedicated script that runs `npx cap sync ios` and then checks the Xcode project for `CapApp-SPM`.
- If `CapApp-SPM` is still missing, it will run Capacitor’s iOS sync/update path again without deleting `ios/`.
- It will fail with a clear message if the local Xcode project is too broken to repair automatically, instead of wiping settings.

### 3. Add safe package commands
- Add npm scripts such as:
  - `npm run ios:repair-spm` for fixing missing Capacitor SPM references.
  - Keep existing build/sync commands, but avoid any destructive `rm -rf ios` workflow.

### 4. Give you the final safe command sequence
After this change, the only local commands should be:

```bash
cd ~/Desktop/shop-flea
git pull
npm install
npm run build
npm run ios:repair-spm
npx cap open ios
```

No `rm -rf ios`. No `npx cap add ios`. No icon/splash rewrite.