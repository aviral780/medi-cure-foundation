-- =====================================================================
-- MediCure · Google Calendar + Google Meet integration
-- Minimal, additive migration. Run once on the external Supabase project.
-- =====================================================================

-- 1) Appointment meeting columns -------------------------------------
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS google_event_id  text,
  ADD COLUMN IF NOT EXISTS meeting_url      text,
  ADD COLUMN IF NOT EXISTS meeting_provider text,
  ADD COLUMN IF NOT EXISTS meeting_status   text,
  ADD COLUMN IF NOT EXISTS meeting_error    text;

CREATE INDEX IF NOT EXISTS appointments_google_event_id_idx
  ON public.appointments (google_event_id);

-- 2) Clinic Google OAuth token store (server-only) --------------------
CREATE TABLE IF NOT EXISTS public.google_oauth_tokens (
  id            smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  google_email  text,
  refresh_token text NOT NULL,
  access_token  text,
  expires_at    timestamptz,
  scope         text,
  connected_at  timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Only the service role may touch this table. No anon/authenticated grants:
-- tokens are never reachable from the browser, even with a valid session.
REVOKE ALL ON public.google_oauth_tokens FROM anon, authenticated;
GRANT ALL ON public.google_oauth_tokens TO service_role;
ALTER TABLE public.google_oauth_tokens ENABLE ROW LEVEL SECURITY;
-- (No policies on purpose → locked for every non-service role.)

-- 3) Safe connection-status view for admins ---------------------------
-- Exposes ONLY whether Google is connected and which account, never a token.
CREATE OR REPLACE FUNCTION public.google_oauth_status()
RETURNS TABLE (oauth_connected boolean, google_email text, connected_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.google_oauth_tokens WHERE id = 1),
    (SELECT google_email FROM public.google_oauth_tokens WHERE id = 1),
    (SELECT connected_at FROM public.google_oauth_tokens WHERE id = 1);
$$;

REVOKE ALL ON FUNCTION public.google_oauth_status() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.google_oauth_status() TO authenticated, service_role;