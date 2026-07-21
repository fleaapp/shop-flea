import Foundation
import Capacitor
import Security

@objc(FleaEntitlementsPlugin)
public class FleaEntitlementsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FleaEntitlementsPlugin"
    public let jsName = "FleaEntitlements"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getApplePayEntitlements", returnType: CAPPluginReturnPromise)
    ]

    @objc func getApplePayEntitlements(_ call: CAPPluginCall) {
        let expectedMerchant = call.getString("merchantIdentifier") ?? "merchant.com.finditonflea.app"
        let entitlementName = "com.apple.developer.in-app-payments"
        var merchantIdentifiers: [String] = []

        if let task = SecTaskCreateFromSelf(nil),
           let value = SecTaskCopyValueForEntitlement(task, entitlementName as CFString, nil) {
            if let merchants = value as? [String] {
                merchantIdentifiers = merchants
            } else if let merchant = value as? String {
                merchantIdentifiers = [merchant]
            }
        }

        call.resolve([
            "expectedMerchant": expectedMerchant,
            "merchantIdentifiers": merchantIdentifiers,
            "hasInAppPaymentsEntitlement": !merchantIdentifiers.isEmpty,
            "hasExpectedMerchant": merchantIdentifiers.contains(expectedMerchant),
        ])
    }
}