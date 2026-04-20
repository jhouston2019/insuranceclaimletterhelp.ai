-- Unified entitlements, Stripe session idempotency, and review usage (2026-04-20)

-- Idempotent processing of Stripe Checkout sessions
CREATE TABLE IF NOT EXISTS public.processed_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_checkout_session_id text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processed_sessions_status ON public.processed_sessions (status);

-- One row per auth user: billing + plan (replaces scattered claim_letters-only checks)
CREATE TABLE IF NOT EXISTS public.user_entitlements (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  stripe_customer_id text UNIQUE,
  plan_type text NOT NULL DEFAULT 'single',
  paid boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  current_period_end timestamptz,
  last_checkout_session_id text,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_entitlements_stripe_customer
  ON public.user_entitlements (stripe_customer_id);

-- Review / analysis usage for plan enforcement
CREATE TABLE IF NOT EXISTS public.user_review_usage (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  review_count int NOT NULL DEFAULT 0,
  period_start timestamptz DEFAULT date_trunc('month', now()),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_review_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own entitlements" ON public.user_entitlements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users read own usage" ON public.user_review_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role processed_sessions" ON public.processed_sessions
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role entitlements" ON public.user_entitlements
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role user_review_usage" ON public.user_review_usage
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');
