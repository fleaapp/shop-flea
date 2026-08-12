import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const distDir = join(root, 'dist');
const androidPublicDir = join(root, 'android', 'app', 'src', 'main', 'public');
const buildId = Date.now().toString();
const buildDate = new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
const marker = 'flea-google-auth-control';

function assertProjectRoot() {
  if (!existsSync(join(root, 'package.json'))) {
    throw new Error('package.json not found. Run this script from the project root.');
  }
  if (!existsSync(join(root, 'capacitor.config.ts'))) {
    throw new Error('capacitor.config.ts not found. Run this script from the project root.');
  }
}

assertProjectRoot();

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, ...extraEnv },
    stdio: 'inherit',
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}.`);
  }
}

function runCaptured(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, ...extraEnv },
    encoding: 'utf8',
    shell: false,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  process.stdout.write(output);
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}.`);
  }
  return output;
}

function filesUnder(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) files.push(...filesUnder(path));
    else files.push(path);
  }
  return files;
}

function assertNativeBundle() {
  if (!existsSync(androidPublicDir)) {
    console.warn(`\nNote: ${androidPublicDir} not found - no android/ project in this environment.`);
    console.warn('The google-services.json and bundle-marker checks run locally after "npx cap add android".');
    return;
  }

  const nativeFiles = filesUnder(androidPublicDir).filter((p) => /\.(?:js|html)$/.test(p));
  if (nativeFiles.length === 0) {
    console.warn('No JS/HTML assets found in the Android public dir yet.');
    return;
  }

  const markerFile = nativeFiles.find((path) => readFileSync(path, 'utf8').includes(marker));
  if (!markerFile) {
    throw new Error(`The Android bundle does not contain ${marker}. The Google sign-in button was not included. Do not archive.`);
  }
  console.log(`Verified Google control marker in ${relative(root, markerFile)}.`);

  const googleServices = join(root, 'android', 'app', 'google-services.json');
  if (!existsSync(googleServices)) {
    throw new Error('android/app/google-services.json is missing. FCM push and Google Sign-In depend on it. Do not archive.');
  }
  console.log('Verified google-services.json present.');
}

try {
  console.log(`Preparing Flea Android bundle ${buildId} (${buildDate})...`);
  rmSync(distDir, { recursive: true, force: true });
  const buildOutput = runCaptured(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'], {
    FLEA_BUILD_ID: buildId,
    FLEA_BUILD_DATE: buildDate,
  });
  if (buildOutput.includes('Circular chunk:')) {
    throw new Error('Vite reported circular chunks. Do not archive.');
  }

  // Only sync + patch if the android/ project exists (local dev machine).
  if (existsSync(join(root, 'android'))) {
    run(process.execPath, [join(root, 'node_modules', '@capacitor', 'cli', 'bin', 'capacitor'), 'sync', 'android']);
    run('/bin/bash', [join(root, 'scripts', 'setup-android-native.sh')]);
    assertNativeBundle();
  } else {
    console.log('\nNo android/ project in this environment - skipping cap sync + native patch.');
    console.log('Run locally: npx cap add android, then npm run android:archive-ready.');
  }

  console.log(`\nSAFE TO ARCHIVE - Flea Android build ${buildId} - ${buildDate}`);
} catch (error) {
  console.error(`\nARCHIVE PREPARATION FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
