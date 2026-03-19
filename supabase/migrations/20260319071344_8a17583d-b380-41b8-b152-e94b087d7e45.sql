
-- Add payment_method to orders (defaults to 'stripe' since that's the only payment method currently)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'stripe';

-- Add message_type to order_messages to distinguish system messages from user messages
ALTER TABLE public.order_messages ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'user';
