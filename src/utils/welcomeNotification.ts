import { supabase } from '@/lib/supabase';

/**
 * Fires the one-time welcome alert (and push, if the user has notifications
 * enabled) for a brand new account. The edge function is idempotent, so this
 * can safely be called more than once.
 */
export async function sendWelcomeNotification(): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('send-welcome-notification', { body: {} });
    if (error) {
      console.warn('[Welcome] notification failed:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Welcome] notification failed:', err);
    return false;
  }
}

export default sendWelcomeNotification;
