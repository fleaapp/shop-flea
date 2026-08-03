# Offer notification copy - confirm and backfill

## What I checked

Live notification rows currently in the database (all offer alerts ever sent):

| Recipient | Type | Message |
|---|---|---|
| @sarahhearn2 (seller) | offer_accepted | 🎉 @jcsbh accepted your $4.25 offer on "Dress". |
| @jcsbh (buyer) | offer_countered | 💰 @sarahhearn2 offered you "Dress" for $4.25. Expires in 24 hours. |
| @sarahhearn2 (seller) | offer_received | 💰 @jcsbh offered $4.50 on "Dress". You have 24 hours to reply. |

The Alerts screen now shows these raw database messages (offer types are in the raw-message whitelist in both `Notifications.tsx` and `useNotifications.ts`), so what is stored is exactly what the user sees.

The current edge function already sends the seller-facing wording you asked for - `.../offers/index.ts` sends "🎉 @actor accepted your $X offer on "Title". They have 24 hours to pay." for the seller and "... It's in your cart at that price for 24 hours." for the buyer. The one row above predates that change, which is why it is missing the trailing sentence.

## What to do

1. Backfill the existing seller-facing `offer_accepted` row so it reads:
   `🎉 @jcsbh accepted your $4.25 offer on "Dress". They have 24 hours to pay.`
   Applied generally: any historical `offer_accepted` row sent to the seller side that lacks a trailing window sentence gets "They have 24 hours to pay." appended; buyer-side rows get "It's in your cart at that price for 24 hours."
2. No code change needed for new notifications - the edge function copy is already correct. I will re-verify each path end to end after the backfill.

## Full offer notification matrix (target wording)

| Event | Recipient | Copy |
|---|---|---|
| Buyer makes offer | Seller | 💰 @buyer offered $X on "Title". You have 24 hours to reply. |
| Counter-offer | Other party | 💰 @actor offered you "Title" for $X. Expires in 24 hours. |
| Seller accepts | Buyer | 🎉 @seller accepted your $X offer on "Title". It's in your cart at that price for 24 hours. |
| Buyer accepts seller offer | Seller | 🎉 @buyer accepted your $X offer on "Title". They have 24 hours to pay. |
| Auto-accept rule fires | Buyer | 🎉 Your $X offer on "Title" was accepted. It's in your cart at that price for 24 hours. |
| Auto-accept rule fires | Seller | 💰 @buyer offered $X on "Title" and it was auto-accepted. They have 24 hours to pay. |
| Declined | Other party | 😔 @actor declined your $X offer on "Title". |
| Blast / special offer | Buyer | 💰 @seller is offering "Title" to you for $X. Expires in 24 hours. |

## Technical notes

- Backfill runs as a migration updating `public.notifications` for `type = 'offer_accepted'` rows only, matched on missing trailing sentence.
- Verification: re-query the offer notification rows and confirm each message matches the matrix and the recipient role.
