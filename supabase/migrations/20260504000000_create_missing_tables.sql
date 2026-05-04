-- 2026-05-04: Ensure tables used by payment/billing Netlify functions exist.
--
-- .from() inventory (claim_letters excluded per product request):
--   stripe-webhook.js:     user_entitlements, processed_sessions, subscriptions, claim_letters
--   verify-payment.js:     processed_sessions, user_entitlements
--   billing-status.js:     (none — delegates to getBillingSnapshot)
--   usage.js:              (none — delegates to getBillingSnapshot)
--   analyze-claim.js:      (none — no Supabase client)
--   _billing-snapshot.js:  user_entitlements, user_review_usage, subscriptions
--
-- Column names match netlify/functions (e.g. stripe_checkout_session_id, review_count, period_start).

-- ---------------------------------------------------------------------------
-- user_entitlements
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan_type text NOT NULL DEFAULT 'single',
  paid boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  current_period_end timestamptz,
  last_checkout_session_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_entitlements_stripe_customer_id
  ON public.user_entitlements (stripe_customer_id);

-- ---------------------------------------------------------------------------
-- processed_sessions (stripe_checkout_session_id = Checkout session id)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.processed_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_checkout_session_id text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processed_sessions_user_id
  ON public.processed_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_processed_sessions_status
  ON public.processed_sessions (status);

-- ---------------------------------------------------------------------------
-- user_review_usage (review_count + period_start — _billing-snapshot.js)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_review_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  review_count integer NOT NULL DEFAULT 0,
  period_start timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- ---------------------------------------------------------------------------
-- subscriptions (stripe-webhook subscription events + billing snapshot)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stripe_customer_id text,
  stripe_subscription_id text NOT NULL,
  plan_type text NOT NULL DEFAULT 'STANDARD',
  status text NOT NULL,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(stripe_subscription_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON public.subscriptions (stripe_customer_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_review_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own entitlements" ON public.user_entitlements;
CREATE POLICY "Users can read own entitlements" ON public.user_entitlements
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own sessions" ON public.processed_sessions;
CREATE POLICY "Users can read own sessions" ON public.processed_sessions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own usage" ON public.user_review_usage;
CREATE POLICY "Users can read own usage" ON public.user_review_usage
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can read own subscriptions" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access entitlements" ON public.user_entitlements;
CREATE POLICY "Service role full access entitlements" ON public.user_entitlements
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access sessions" ON public.processed_sessions;
CREATE POLICY "Service role full access sessions" ON public.processed_sessions
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access usage" ON public.user_review_usage;
CREATE POLICY "Service role full access usage" ON public.user_review_usage
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access subscriptions" ON public.subscriptions;
CREATE POLICY "Service role full access subscriptions" ON public.subscriptions
  FOR ALL USING (auth.role() = 'service_role');
