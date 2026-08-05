# Finish 17track tracking integration

## What we verified
- The correct webhook URL uses `?token=` (not `?secret=`).
- Frontend already calls `tracking-register` when a seller marks an order as shipped.
- `TrackingEvents` component is already rendered in both buyer order details and seller sale details.
- The `tracking-register`, `tracking-webhook`, and `tracking-sync` edge functions exist in code but are not yet deployed.

## Remaining steps
1. Deploy the three tracking edge functions (`tracking-register`, `tracking-webhook`, `tracking-sync`).
2. Send a test POST to the webhook URL to confirm it returns a 401 without the token and accepts requests with the token.
3. Confirm 17track can reach the endpoint by checking for a successful registration response the next time a seller ships an order.
4. Verify `TrackingEvents` renders carrier scan history in order/sale detail drawers.

## Expected result
- Live carrier scans from 17track flow into the app.
- Orders automatically move to `delivered` when the carrier reports delivery.
- Sellers and buyers can see full tracking history inside the app.
