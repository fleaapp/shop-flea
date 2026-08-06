# Remaining Critical and High Audit Items

All four Critical items are now closed (offer race, funds releasing mid-dispute, reviewer bypass, blank home feed), along with H1, H2, H3, H6 and H9.

Four High items remain. H4 and H7 are the ones with real user impact.

---

## H4. Seller balance goes stale after a refund (money risk)

Today the refund webhook marks the order refunded and notifies both sides, but it never touches the seller's owed balance. That figure is only recalculated when the seller happens to open a screen that calls the status function. A seller can withdraw their money, get refunded against afterwards, and keep trading against a balance that is wrong.

Build:
- In the refund and dispute branches of the payment webhook, recalculate the seller's owed amount and write it back immediately.
- Same recalculation on a successful payout, so the two paths can never disagree.
- If the seller ends up owing money, raise the existing "action required" state so the dashboard reflects it on next open rather than on next status poll.

## H7. Listing forms lose everything on back

The back chevron on Create Listing and Edit Listing navigates away immediately. Photos, price, brand and description are gone in one tap, with no warning.

Build:
- Track whether the form has been touched since it loaded (or since last save).
- If it has, the back chevron and the hardware/swipe back open a "Discard changes?" confirm in the house dialog style - Cancel left, destructive right.
- Untouched forms keep the current instant-back behaviour.

## H8. Icon-only buttons: no accessible name, tap targets under 44px

Sixteen buttons across chat, support, profile and settings screens are bare icons with no label, several with no padding. Screen readers announce only "button", and the smallest targets are hard to hit accurately.

Build:
- Standardise every icon-only control on the pattern already used correctly in the admin screens: ghost icon button, explicit `aria-label`, minimum 44x44 tap area.
- No visual change intended beyond slightly larger touch padding on the worst offenders (order chat send/attach, suggestion box, edit profile).

## H5. "Stripe" is named in the Privacy Policy - needs your call

The brand rule says never name the payment provider in user-facing copy, but a privacy policy arguably has to name the actual data processor to be a truthful disclosure under APP 6 and APP 8.

Default in this plan: rename the four visible mentions to "our card-payment provider" and keep the working link to the provider's privacy policy, so the disclosure is still complete. Tell me if you would rather keep the entity name and treat the Privacy Policy as a standing exception.

---

## Not fixable from here

Storage buckets still have no server-side size or file-type limits (M7). That setting is locked from the migration tooling on this project, so uploads keep relying on client-side checks. Worth raising with support if you want it enforced before launch.

---

## Technical notes

- `supabase/functions/stripe-webhook/index.ts` - `charge.refunded` / `refund.created` / `charge.dispute.*` branches gain a `profiles.negative_balance_cents` recompute via the service client; mirrored in `stripe-connect-payout`.
- `src/pages/CreateListing.tsx`, `src/pages/EditListing.tsx` - dirty flag plus `AlertDialog` gate in front of `safeNavigateBack`.
- Accessibility sweep across `OrderChat.tsx`, `SuggestionBox.tsx`, `EditProfile.tsx`, `ChatConversation.tsx`, `ContactSupport.tsx`, `FAQ.tsx` and the other flagged files.
- `src/pages/PrivacyPolicy.tsx` lines 63, 100, 126, 236.
