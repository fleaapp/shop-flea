import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function requireFile(path, label) {
  if (!existsSync(path)) {
    throw new Error(`${label} not found at ${path}. Run npm install again after dependencies finish installing.`);
  }
}

function writeIfChanged(path, before, after, label) {
  if (before === after) {
    console.log(`${label}: already patched`);
    return;
  }

  writeFileSync(path, after);
  console.log(`${label}: patched`);
}

function patchStripePackageSwift() {
  const path = join(root, 'node_modules', '@capacitor-community', 'stripe', 'Package.swift');
  requireFile(path, '@capacitor-community/stripe Package.swift');

  const before = readFileSync(path, 'utf8');
  const after = before.replace(
    '.package(url: "https://github.com/stripe/stripe-ios-spm.git", .upToNextMinor(from: "25.9.0"))',
    '.package(url: "https://github.com/stripe/stripe-ios-spm.git", exact: "25.9.0")',
  );

  if (!after.includes('.package(url: "https://github.com/stripe/stripe-ios-spm.git", exact: "25.9.0")')) {
    throw new Error('Could not pin Stripe iOS SDK to exact 25.9.0. Stripe Package.swift format changed.');
  }

  writeIfChanged(path, before, after, 'Stripe iOS SDK pin');
}

function patchStripePlugin() {
  const path = join(
    root,
    'node_modules',
    '@capacitor-community',
    'stripe',
    'ios',
    'Sources',
    'StripePlugin',
    'StripePlugin.swift',
  );
  requireFile(path, '@capacitor-community/stripe StripePlugin.swift');

  const before = readFileSync(path, 'utf8');
  if (before.includes('STPAPIClient.shared.stripeAccount = nil')) {
    console.log('Stripe account reset: already patched');
    return;
  }

  const original = `        if stripeAccount != "" {
            STPAPIClient.shared.stripeAccount = stripeAccount
        }
`;
  const replacement = `        if stripeAccount != "" {
            STPAPIClient.shared.stripeAccount = stripeAccount
        } else {
            // Reset any connected-account context from an earlier native call.
            // Platform PaymentIntents (destination charges) must be confirmed on
            // the platform account; leaving a stale Stripe-Account header here
            // breaks native Apple Pay while web/PWA checkout still works.
            STPAPIClient.shared.stripeAccount = nil
        }
`;

  if (!before.includes(original)) {
    throw new Error('Could not patch Stripe account reset. StripePlugin.swift format changed.');
  }

  writeFileSync(path, before.replace(original, replacement));
  console.log('Stripe account reset: patched');
}

function patchPushNotificationsPlugin() {
  const path = join(
    root,
    'node_modules',
    '@capacitor',
    'push-notifications',
    'ios',
    'Sources',
    'PushNotificationsPlugin',
    'PushNotificationsPlugin.swift',
  );
  requireFile(path, '@capacitor/push-notifications PushNotificationsPlugin.swift');

  const before = readFileSync(path, 'utf8');
  let after = before;

  if (!after.includes('import ObjectiveC.runtime')) {
    after = after.replace('import UserNotifications\n', 'import UserNotifications\nimport ObjectiveC.runtime\n');
  }

  if (!after.includes('self.installAppDelegateForwardersIfNeeded()')) {
    after = after.replace(
      '    override public func load() {\n',
      '    override public func load() {\n        self.installAppDelegateForwardersIfNeeded()\n',
    );
  }

  if (!after.includes('private func installAppDelegateForwardersIfNeeded()')) {
    const forwarder = `
    private func installAppDelegateForwardersIfNeeded() {
        DispatchQueue.main.async {
            guard let appDelegate = UIApplication.shared.delegate else {
                return
            }

            let delegateClass: AnyClass = type(of: appDelegate)

            let didRegisterSelector = NSSelectorFromString("application:didRegisterForRemoteNotificationsWithDeviceToken:")
            if class_getInstanceMethod(delegateClass, didRegisterSelector) == nil {
                let didRegisterBlock: @convention(block) (AnyObject, UIApplication, Data) -> Void = { _, _, deviceToken in
                    NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
                }
                class_addMethod(
                    delegateClass,
                    didRegisterSelector,
                    imp_implementationWithBlock(didRegisterBlock as Any),
                    "v@:@@"
                )
            }

            let didFailSelector = NSSelectorFromString("application:didFailToRegisterForRemoteNotificationsWithError:")
            if class_getInstanceMethod(delegateClass, didFailSelector) == nil {
                let didFailBlock: @convention(block) (AnyObject, UIApplication, NSError) -> Void = { _, _, error in
                    NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
                }
                class_addMethod(
                    delegateClass,
                    didFailSelector,
                    imp_implementationWithBlock(didFailBlock as Any),
                    "v@:@@"
                )
            }
        }
    }
`;

    if (!after.includes('    deinit {')) {
      throw new Error('Could not patch APNs forwarders. PushNotificationsPlugin.swift format changed.');
    }

    after = after.replace('    deinit {', `${forwarder}\n    deinit {`);
  }

  if (!after.includes('import ObjectiveC.runtime') || !after.includes('private func installAppDelegateForwardersIfNeeded()')) {
    throw new Error('Push notification native patch verification failed.');
  }

  writeIfChanged(path, before, after, 'Push notification APNs bridge');
}

try {
  // Stripe plugin patches removed — reverting to vendored @capacitor-community/stripe
  // and its default Stripe iOS SDK resolution. The forced STPAPIClient.shared.stripeAccount
  // reset and the exact SDK pin were introduced 2026-07-22 and coincided with native
  // Apple Pay failing ("Apple Pay Is Not Available in Flea"). Keeping only the
  // push-notifications APNs bridge patch, which is unrelated to payments and proven required.
  patchPushNotificationsPlugin();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}