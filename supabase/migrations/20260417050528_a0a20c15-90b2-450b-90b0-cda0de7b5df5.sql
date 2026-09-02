
-- Create table to track processed Stripe webhook events for idempotency
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  processed_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'processed',
  error_message text,
  payload jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_stripe_event_id 
  ON public.stripe_webhook_events(stripe_event_id);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_event_type 
  ON public.stripe_webhook_events(event_type);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed_at
  ON public.stripe_webhook_events(processed_at DESC);

-- Enable RLS - only service role (webhook) should access this
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- No public policies - service role bypasses RLS automatically
-- This ensures only the webhook edge function can read/write events
