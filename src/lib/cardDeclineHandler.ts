// Maps Stripe card-decline errors to actionable buyer-facing copy and logs
// the raw decline code to error_logs for admin visibility.
import { supabase } from '@/lib/supabase';

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;

type StripeErrorLike = {
  code?: string;
  decline_code?: string;
  type?: string;
  message?: string;
  payment_intent?: { id?: string; last_payment_error?: unknown };
};

/**
 * Turn a Stripe card error into a specific, non-generic buyer message.
 * Falls back to "bank declined" copy so users know the next step.
 */
export function mapCardDeclineMessage(error: StripeErrorLike | null | undefined): string {
  const decline = (error?.decline_code || '').toLowerCase();
  const code = (error?.code || '').toLowerCase();

  switch (decline || code) {
    case 'insufficient_funds':
      return 'Not enough funds on this card. Try another card or Apple Pay.';
    case 'expired_card':
      return 'This card has expired.';
    case 'incorrect_cvc':
    case 'invalid_cvc':
      return 'The security code (CVC) is incorrect.';
    case 'incorrect_number':
    case 'invalid_number':
      return 'The card number is incorrect.';
    case 'incorrect_zip':
    case 'invalid_zip':
      return 'The billing postcode does not match this card.';
    case 'lost_card':
    case 'stolen_card':
    case 'pickup_card':
      return 'Your bank blocked this card. Please contact your bank.';
    case 'card_not_supported':
      return 'This card type is not supported for this purchase.';
    case 'currency_not_supported':
      return 'This card can\u2019t be charged in AUD.';
    case 'card_velocity_exceeded':
      return 'This card has hit its limit. Try again later or use a different card.';
    case 'authentication_required':
      return 'Your bank needs to verify this payment but the verification did not complete.';
    case 'do_not_honor':
    case 'generic_decline':
    case 'transaction_not_allowed':
    case 'call_issuer':
      return 'Your bank declined this card. Try Apple Pay or contact your bank and mention the merchant \u201CFLEA\u201D.';
    default:
      return error?.message || 'Card was declined. Please try another card or Apple Pay.';
  }
}

/**
 * Fire-and-forget: log the raw Stripe error to public.error_logs so admin can
 * see the exact decline code, PaymentIntent id, and last_payment_error.
 */
export async function logCardDecline(context: {
  where: string;
  error: StripeErrorLike | null | undefined;
  paymentIntentId?: string | null;
  amountCents?: number | null;
}): Promise<void> {
  try {
    if (!PROJECT_ID) return;
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    const body = {
      source: 'payment',
      severity: 'error',
      title: `Card declined (${context.where})`,
      message:
        context.error?.decline_code
          ? `decline_code=${context.error.decline_code} code=${context.error.code || ''}`
          : (context.error?.code ? `code=${context.error.code}` : context.error?.message || 'card_declined'),
      route: typeof window !== 'undefined' ? window.location.pathname : null,
      context: {
        stripe_code: context.error?.code ?? null,
        stripe_decline_code: context.error?.decline_code ?? null,
        stripe_type: context.error?.type ?? null,
        stripe_message: context.error?.message ?? null,
        payment_intent_id:
          context.paymentIntentId ?? context.error?.payment_intent?.id ?? null,
        last_payment_error: context.error?.payment_intent?.last_payment_error ?? null,
        amount_cents: context.amountCents ?? null,
      },
      dedupe_key: `card-decline:${context.error?.decline_code || context.error?.code || 'unknown'}:${context.paymentIntentId || ''}`,
    };
    await fetch(`https://${PROJECT_ID}.supabase.co/functions/v1/log-error`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    // never let logging break checkout
  }
}
