-- One Stripe customer → one user. Named UNIQUE constraint; dedupe before apply.
-- Safe to run if user_entitlements.stripe_customer_id already has UNIQUE (constraint is recreated with explicit name).

DELETE FROM public.user_entitlements a
  USING public.user_entitlements b
 WHERE a.stripe_customer_id IS NOT NULL
   AND b.stripe_customer_id IS NOT NULL
   AND a.stripe_customer_id = b.stripe_customer_id
   AND a.user_id::text > b.user_id::text;

ALTER TABLE public.user_entitlements
  DROP CONSTRAINT IF EXISTS user_entitlements_stripe_customer_id_key;

ALTER TABLE public.user_entitlements
  DROP CONSTRAINT IF EXISTS unique_stripe_customer_id;

ALTER TABLE public.user_entitlements
  ADD CONSTRAINT unique_stripe_customer_id UNIQUE (stripe_customer_id);
