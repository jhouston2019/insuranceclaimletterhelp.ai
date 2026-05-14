-- Persists wizard form + analysis keyed by Stripe Checkout session id (guest checkout restore).
CREATE TABLE IF NOT EXISTS public.wizard_checkout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id TEXT NOT NULL UNIQUE,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wizard_checkout_sessions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.wizard_checkout_sessions IS 'Claim-defense wizard snapshot for Stripe guest checkout — server-only via service role.';
