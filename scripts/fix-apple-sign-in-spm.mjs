import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const packageSwiftPath = join(
  process.cwd(),
  'node_modules',
  '@capacitor-community',
  'apple-sign-in',
  'Package.swift'
);

if (!existsSync(packageSwiftPath)) {
  process.exit(0);
}

const before = readFileSync(packageSwiftPath, 'utf8');
const after = before.replace(
  /\.package\(url: "https:\/\/github\.com\/ionic-team\/capacitor-swift-pm\.git",\s*(?:from:\s*"7\.0\.0"|"7\.0\.0"\s*\.\.<\s*"9\.0\.0"|from:\s*"8\.0\.0")\)/,
  '.package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")'
);

if (after !== before) {
  writeFileSync(packageSwiftPath, after);
  console.log('Aligned @capacitor-community/apple-sign-in with Capacitor 8 SwiftPM.');
}