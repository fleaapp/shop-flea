import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const distDir = join(root, 'dist');
const iosPublicDir = join(root, 'ios', 'App', 'App', 'public');
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
  if (!existsSync(join(root, 'scripts', 'prepare-ios-archive.mjs'))) {
    throw new Error('prepare-ios-archive.mjs is missing. Run "git pull" to sync the latest cloud changes.');
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

// Runs a command while capturing its output so we can assert on build warnings.
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
  if (!existsSync(iosPublicDir)) {
    throw new Error('Capacitor did not create ios/App/App/public. Do not archive.');
  }

  const indexPath = join(iosPublicDir, 'index.html');
  if (!existsSync(indexPath)) {
    throw new Error('The copied iOS bundle has no index.html. Do not archive.');
  }

  const nativeFiles = filesUnder(iosPublicDir);
  const markerFile = nativeFiles.find((path) => {
    if (!/\.(?:js|html)$/.test(path)) return false;
    return readFileSync(path, 'utf8').includes(marker);
  });
  if (!markerFile) {
    throw new Error(`The copied iOS bundle does not contain ${marker}. The Google sign-in button was not included. Do not archive.`);
  }

  const indexHtml = readFileSync(indexPath, 'utf8');
  const assetRefs = [...indexHtml.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g)]
    .map((match) => match[1])
    .filter((asset) => !/^https?:/.test(asset));
  if (assetRefs.length === 0) {
    throw new Error('The copied iOS index.html contains no local JavaScript or CSS assets. Do not archive.');
  }
  for (const assetRef of assetRefs) {
    const normalized = assetRef.replace(/^\.\//, '').replace(/^\//, '');
    if (!existsSync(join(iosPublicDir, normalized))) {
      throw new Error(`The copied iOS index references missing asset ${assetRef}. Do not archive.`);
    }
  }

  // Surface which social-auth code paths are present in the bundle.
  const bundleText = nativeFiles
    .filter((path) => /\.(?:js|html)$/.test(path))
    .map((path) => readFileSync(path, 'utf8'))
    .join('\n');
  const hasGoogle = bundleText.includes('handleGoogleSignIn');
  const hasApple = bundleText.includes('handleAppleSignIn');
  const hasOAuthPopup = bundleText.includes('signInWithOAuthPopup');

  console.log(`\nVerified Google control marker in ${relative(root, markerFile)}.`);
  console.log('Bundle social-auth paths:');
  console.log(`  Google handler: ${hasGoogle ? 'yes' : 'NO'}`);
  console.log(`  Apple handler:  ${hasApple ? 'yes' : 'NO'}`);
  console.log(`  OAuth popup:    ${hasOAuthPopup ? 'yes' : 'NO'}`);
}

try {
  console.log(`Preparing Flea iOS bundle ${buildId} (${buildDate})...`);
  rmSync(distDir, { recursive: true, force: true });
  const buildOutput = runCaptured(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'], {
    FLEA_BUILD_ID: buildId,
    FLEA_BUILD_DATE: buildDate,
  });
  if (buildOutput.includes('Circular chunk:')) {
    throw new Error(
      'Vite reported circular chunks. A bundle with circular chunks fails to evaluate at runtime and boots to a blank screen. Fix manualChunks in vite.config.ts. Do not archive.',
    );
  }
  run(process.execPath, [join(root, 'node_modules', '@capacitor', 'cli', 'bin', 'capacitor'), 'sync', 'ios']);
  run('/bin/bash', [join(root, 'scripts', 'setup-ios-native.sh')]);
  assertNativeBundle();
  console.log(`\nSAFE TO ARCHIVE - Flea build ${buildId} - ${buildDate}`);
} catch (error) {
  console.error(`\nARCHIVE PREPARATION FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}