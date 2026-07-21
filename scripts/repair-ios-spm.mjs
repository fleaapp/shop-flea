#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const iosDir = join(root, 'ios', 'App');
const pbxprojPath = join(iosDir, 'App.xcodeproj', 'project.pbxproj');
const capSpmDir = join(iosDir, 'CapApp-SPM');
const capSpmPackage = join(capSpmDir, 'Package.swift');
const template = join(root, 'node_modules', '@capacitor', 'cli', 'assets', 'ios-spm-template.tar.gz');

const ids = {
  packageReference: 'F1EA00000000000000000001',
  productDependency: 'F1EA00000000000000000002',
  frameworkBuildFile: 'F1EA00000000000000000003',
};

function run(command, args, options = {}) {
  console.log(`==> ${command} ${args.join(' ')}`);
  execFileSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    ...options,
  });
}

function fail(message) {
  console.error(`\nERROR: ${message}`);
  process.exit(1);
}

function requireExistingProject() {
  if (!existsSync(pbxprojPath)) {
    fail('ios/App/App.xcodeproj/project.pbxproj is missing. This repair preserves an existing Xcode project; it will not recreate ios/ or run npx cap add ios.');
  }
  if (!existsSync(template)) {
    fail('Capacitor SPM template is missing. Run npm install first, then rerun npm run ios:repair-spm.');
  }
}

function restoreCapSpmDirectoryIfMissing() {
  if (existsSync(capSpmPackage)) {
    console.log('==> CapApp-SPM directory already exists');
    return false;
  }

  console.log('==> Restoring missing CapApp-SPM directory from Capacitor template');
  rmSync(capSpmDir, { recursive: true, force: true });
  mkdirSync(iosDir, { recursive: true });
  run('tar', ['-xzf', template, '-C', iosDir, '--strip-components=1', 'App/CapApp-SPM']);

  if (!existsSync(capSpmPackage)) {
    fail('CapApp-SPM restore failed.');
  }

  return true;
}

function addToListBlock(text, objectName, listName, entry) {
  const objectStart = text.indexOf(objectName);
  if (objectStart === -1) return text;

  const listStart = text.indexOf(`${listName} = (`, objectStart);
  if (listStart === -1) return text;

  const listEnd = text.indexOf(');', listStart);
  if (listEnd === -1) return text;

  const listBody = text.slice(listStart, listEnd);
  if (listBody.includes(entry.trim())) return text;

  const insertAt = text.indexOf('\n', listStart) + 1;
  return `${text.slice(0, insertAt)}${entry}${text.slice(insertAt)}`;
}

function addPackageProductDependenciesIfNeeded(text) {
  if (text.includes(`${ids.productDependency} /* CapApp-SPM */,`)) return text;

  const targetMatch = text.match(/\n\t\t[A-F0-9]{24} \/\* App \*\/ = \{\n\t\t\tisa = PBXNativeTarget;[\s\S]*?\n\t\t\};/);
  if (!targetMatch) return text;

  const target = targetMatch[0];
  let nextTarget = target;

  if (target.includes('packageProductDependencies = (')) {
    nextTarget = addToListBlock(target, 'isa = PBXNativeTarget;', 'packageProductDependencies', `\t\t\t\t${ids.productDependency} /* CapApp-SPM */,\n`);
  } else {
    nextTarget = target.replace(
      /\n\t\t\tproductName = App;/,
      `\n\t\t\tpackageProductDependencies = (\n\t\t\t\t${ids.productDependency} /* CapApp-SPM */,\n\t\t\t);\n\t\t\tproductName = App;`,
    );
  }

  return text.replace(target, nextTarget);
}

function addProjectPackageReferencesIfNeeded(text) {
  if (text.includes(`${ids.packageReference} /* XCLocalSwiftPackageReference "CapApp-SPM" */,`)) return text;

  const projectMatch = text.match(/\n\t\t[A-F0-9]{24} \/\* Project object \*\/ = \{\n\t\t\tisa = PBXProject;[\s\S]*?\n\t\t\};/);
  if (!projectMatch) return text;

  const project = projectMatch[0];
  let nextProject = project;

  if (project.includes('packageReferences = (')) {
    nextProject = addToListBlock(project, 'isa = PBXProject;', 'packageReferences', `\t\t\t\t${ids.packageReference} /* XCLocalSwiftPackageReference "CapApp-SPM" */,\n`);
  } else {
    nextProject = project.replace(
      /\n\t\t\tproductRefGroup = /,
      `\n\t\t\tpackageReferences = (\n\t\t\t\t${ids.packageReference} /* XCLocalSwiftPackageReference "CapApp-SPM" */,\n\t\t\t);\n\t\t\tproductRefGroup = `,
    );
  }

  return text.replace(project, nextProject);
}

function ensureSection(text, sectionName, sectionContent) {
  const begin = `/* Begin ${sectionName} section */`;
  const end = `/* End ${sectionName} section */`;

  if (text.includes(sectionContent.trim())) return text;

  if (text.includes(begin) && text.includes(end)) {
    const insertAt = text.indexOf(end);
    return `${text.slice(0, insertAt)}${sectionContent}${text.slice(insertAt)}`;
  }

  const insertBefore = text.lastIndexOf('\n\t};');
  if (insertBefore === -1) return text;
  return `${text.slice(0, insertBefore)}\n/* Begin ${sectionName} section */\n${sectionContent}/* End ${sectionName} section */\n${text.slice(insertBefore)}`;
}

function patchProjectReferencesIfMissing() {
  let text = readFileSync(pbxprojPath, 'utf8');
  const before = text;

  if (!text.includes(`${ids.frameworkBuildFile} /* CapApp-SPM in Frameworks */`)) {
    text = ensureSection(
      text,
      'PBXBuildFile',
      `\t\t${ids.frameworkBuildFile} /* CapApp-SPM in Frameworks */ = {isa = PBXBuildFile; productRef = ${ids.productDependency} /* CapApp-SPM */; };\n`,
    );
  }

  if (!text.includes(`${ids.frameworkBuildFile} /* CapApp-SPM in Frameworks */,`)) {
    text = addToListBlock(text, 'isa = PBXFrameworksBuildPhase;', 'files', `\t\t\t\t${ids.frameworkBuildFile} /* CapApp-SPM in Frameworks */,\n`);
  }

  text = addPackageProductDependenciesIfNeeded(text);
  text = addProjectPackageReferencesIfNeeded(text);

  text = ensureSection(
    text,
    'XCLocalSwiftPackageReference',
    `\t\t${ids.packageReference} /* XCLocalSwiftPackageReference "CapApp-SPM" */ = {\n\t\t\tisa = XCLocalSwiftPackageReference;\n\t\t\trelativePath = "CapApp-SPM";\n\t\t};\n`,
  );

  text = ensureSection(
    text,
    'XCSwiftPackageProductDependency',
    `\t\t${ids.productDependency} /* CapApp-SPM */ = {\n\t\t\tisa = XCSwiftPackageProductDependency;\n\t\t\tpackage = ${ids.packageReference} /* XCLocalSwiftPackageReference "CapApp-SPM" */;\n\t\t\tproductName = "CapApp-SPM";\n\t\t};\n`,
  );

  if (text !== before) {
    writeFileSync(pbxprojPath, text);
    console.log('==> Repaired CapApp-SPM references in project.pbxproj');
    return true;
  }

  console.log('==> CapApp-SPM references already exist in project.pbxproj');
  return false;
}

function verify() {
  const text = readFileSync(pbxprojPath, 'utf8');
  const checks = [
    ['CapApp-SPM directory', existsSync(capSpmPackage)],
    ['Framework build file', text.includes('CapApp-SPM in Frameworks')],
    ['Local package reference', text.includes('XCLocalSwiftPackageReference "CapApp-SPM"')],
    ['Product dependency', text.includes('productName = "CapApp-SPM"')],
    ['Target package dependency', text.includes('/* CapApp-SPM */,')],
  ];

  console.log('\n==> Verification');
  for (const [label, ok] of checks) {
    console.log(`   ${label}: ${ok ? 'yes' : 'NO'}`);
  }

  const failed = checks.filter(([, ok]) => !ok).map(([label]) => label);
  if (failed.length) {
    fail(`CapApp-SPM repair is incomplete: ${failed.join(', ')}. Open Xcode Package Dependencies and add local package ios/App/CapApp-SPM manually; do not delete ios/.`);
  }
}

requireExistingProject();
restoreCapSpmDirectoryIfMissing();
run('npx', ['cap', 'sync', 'ios']);
restoreCapSpmDirectoryIfMissing();
const patched = patchProjectReferencesIfMissing();
if (patched) {
  run('npx', ['cap', 'sync', 'ios']);
}
verify();
console.log('\nDone. Open Xcode with: npx cap open ios');