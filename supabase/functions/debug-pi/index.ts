import Stripe from "https://esm.sh/stripe@18.5.0";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const { pi_id, account_id } = await req.json();
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });
  const out: any = {};
  try {
    if (pi_id) {
      const pi = await stripe.paymentIntents.retrieve(pi_id, { expand: ["latest_charge", "latest_charge.balance_transaction", "latest_charge.transfer"] });
      out.pi = { id: pi.id, amount: pi.amount, application_fee_amount: pi.application_fee_amount, transfer_data: pi.transfer_data, on_behalf_of: pi.on_behalf_of };
      const charge: any = pi.latest_charge;
      if (charge) {
        out.charge = { id: charge.id, transfer: charge.transfer, destination: charge.destination, application_fee: charge.application_fee, on_behalf_of: charge.on_behalf_of };
        if (charge.transfer) {
          const tr = await stripe.transfers.retrieve(typeof charge.transfer === 'string' ? charge.transfer : charge.transfer.id);
          out.transfer = tr;
        }
      }
    }
    if (account_id) {
      const bal = await stripe.balance.retrieve({ stripeAccount: account_id });
      out.connected_balance = bal;
      const payouts = await stripe.payouts.list({ limit: 5 }, { stripeAccount: account_id });
      out.payouts = payouts.data;
      const acct = await stripe.accounts.retrieve(account_id);
      out.account = { id: acct.id, payouts_enabled: acct.payouts_enabled, charges_enabled: acct.charges_enabled, requirements: acct.requirements, settings_payouts: acct.settings?.payouts };
    }
  } catch (e: any) { out.error = e.message; }
  return new Response(JSON.stringify(out, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
