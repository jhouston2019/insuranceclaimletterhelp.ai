-- Insurance Claim Response Pro — canonical site name in the database
-- Safe to re-run: upserts the site name and refreshes policies.

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.platform_settings IS
'Public site-wide settings (e.g. platform display name for Insurance Claim Response Pro)';

INSERT INTO public.platform_settings (key, value) VALUES
  ('site_name', 'Insurance Claim Response Pro')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read platform_settings" ON public.platform_settings;
CREATE POLICY "Public read platform_settings"
  ON public.platform_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);
