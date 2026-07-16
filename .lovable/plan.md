## Status of legal docs vs recent changes

Already covered correctly in `src/pages/Terms.tsx` and `src/pages/PrivacyPolicy.tsx`:
- Buyer Secure Checkout Fee at **4% + $0.70** (Terms §8)
- **1.5% instant payout** fee (Terms §8)
- Sellers pay no selling fees; GST is seller's responsibility (Terms §8)
- Seller ID verification / KYC, AML-CTF Act reference, ID sent directly to payment processor, not stored by Flea (Terms §9, Privacy §2)
- 3-day dispatch / 6-day overdue / 10-day refund window (Terms §10, §11)
- 14-day deletion cooldown, no new account after suspension (Terms §4, §14)
- Refunds/disputes/webhook data disclosure (Privacy §2, §3)

Not yet reflected in the docs (added in recent turns):
1. **Negative balance settlement**: buyers/sellers with a negative Flea balance from refunds, disputes or chargebacks must settle in-app before buying, listing, or deleting their account.
2. **Device-level block**: creating a new account on the same device is blocked while a previous account on that device has an unsettled negative balance (backed by `blocked_devices` and `device_ids`).
3. **In-app top-up**: users can settle the outstanding amount via the Settle Balance flow (`stripe-connect-topup`); until settled, buying and publishing are disabled and account deletion is refused.
4. **Coupon codes** (e.g. `FREEFLEA` waiving buyer fees): promotional codes are a discretionary Flea promotion, may be withdrawn or limited at any time, single-use per account, no cash value, void if fraud/abuse suspected.
5. **Device identifier** (`device_ids`) collection needs to be disclosed in the Privacy Policy under Identifiers, alongside its purpose (fraud prevention / negative balance enforcement).

## Proposed edits

**`src/pages/Terms.tsx`**
- Extend §8 (Fees) with a "Negative balances" paragraph: refunds, chargebacks, disputes and reversals may create a negative balance; buying and listing are paused until settled; Flea may recover the amount from future sales, from the seller's connected payment account, or via the in-app Settle Balance top-up; unsettled negative balances are a debt owed to Flea.
- Extend §4 (Account eligibility) or §14 (Suspension/termination) with a "Device-level restriction" clause: while an unsettled negative balance exists on an account, a new account cannot be created on the same device.
- Add §8a or bullet in §14: account deletion is refused while a negative balance is outstanding.
- Add new short section "Promotional codes and discounts": Flea may issue promo codes (such as fee waivers). Codes are single-use per account unless stated, non-transferable, no cash value, may be revoked for abuse or fraud, and Flea may withdraw or change any promotion on notice.

**`src/pages/PrivacyPolicy.tsx`**
- In §2 (What we collect) under Identifiers/Device, add `device_ids` — a stable device identifier used for fraud prevention and to enforce negative-balance settlement across accounts on the same device.
- In §3 (How we use your data), add a bullet: "Prevent creation of duplicate accounts and enforce settlement of outstanding balances, including by recording a device identifier associated with your account."
- Update `docs/app-store-privacy-questionnaire.md` Identifiers section to mention the device identifier (still under "User ID / Identifiers", not IDFA — no ATT change needed).

No changes needed to fees, GST, KYC, or refund copy — those already match the current implementation.

## Technical details

Files to edit:
- `src/pages/Terms.tsx` — add negative-balance, device-restriction, and promo-code clauses.
- `src/pages/PrivacyPolicy.tsx` — add device identifier disclosure + purpose.
- `docs/app-store-privacy-questionnaire.md` — mirror the identifier disclosure so App Store answers stay in sync.

No schema, edge function, or UI logic changes — this is copy only.
