/**
 * Helper to enqueue a transactional email from another Edge Function.
 * Uses the service role to call send-transactional-email, which enqueues
 * into the transactional_emails pgmq queue and checks suppression.
 */
export async function sendTransactionalEmail(args: {
  supabaseUrl: string
  serviceKey: string
  templateName: string
  recipientEmail: string
  idempotencyKey: string
  templateData?: Record<string, unknown>
}) {
  const { supabaseUrl, serviceKey, templateName, recipientEmail, idempotencyKey, templateData = {} } = args

  if (!recipientEmail || !recipientEmail.includes('@')) {
    console.warn('[sendTransactionalEmail] skipping invalid email for template', templateName)
    return { ok: false, skipped: true }
  }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        templateName,
        recipientEmail,
        idempotencyKey,
        templateData,
      }),
    })

    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error('[sendTransactionalEmail] failed:', res.status, body)
      return { ok: false, status: res.status, body }
    }

    return { ok: true, body }
  } catch (error) {
    console.error('[sendTransactionalEmail] exception:', error)
    return { ok: false, error }
  }
}

/**
 * Fetch a user's email address from auth.users via service role.
 */
export async function getUserEmail(supabaseUrl: string, serviceKey: string, userId: string): Promise<string | null> {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/profiles?user_id=eq.${userId}&select=email`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    })
    if (!res.ok) return null
    const rows = await res.json()
    return rows?.[0]?.email || null
  } catch (e) {
    console.error('[getUserEmail] failed:', e)
    return null
  }
}

/**
 * Check whether a user has opted in to order email notifications.
 * Defaults to true if the column is missing or the row doesn't exist.
 */
export async function wantsOrderEmails(supabaseUrl: string, serviceKey: string, userId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/profiles?user_id=eq.${userId}&select=email_order_notifications`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    )
    if (!res.ok) return true
    const rows = await res.json()
    const val = rows?.[0]?.email_order_notifications
    return val === null || val === undefined || val === true
  } catch (e) {
    console.error('[wantsOrderEmails] failed:', e)
    return true
  }
}
