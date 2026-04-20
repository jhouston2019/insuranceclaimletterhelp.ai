-- Typed helper: review usage for RPC callers (PostgREST / SQL)

CREATE OR REPLACE FUNCTION public.get_user_plan_usage(p_user_id uuid)
RETURNS TABLE (
  review_count integer,
  period_start timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(
      (SELECT u.review_count FROM public.user_review_usage u WHERE u.user_id = p_user_id),
      0
    )::integer,
    COALESCE(
      (SELECT u.period_start FROM public.user_review_usage u WHERE u.user_id = p_user_id),
      date_trunc('month', now())
    );
$$;
