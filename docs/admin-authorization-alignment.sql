-- Align admin authorization with public.admins as the single source of truth.
-- Apply this migration on the external Supabase project used by MediCure.
--
-- After this runs, the Admin Dashboard queries (appointments, payments,
-- profiles) will return full data for any user with an active row in
-- public.admins. All existing patient policies are preserved and continue
-- to scope patients to their own rows via auth.uid().

-- 1) Single source of truth: public.admins
CREATE OR REPLACE FUNCTION public.is_active_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admins
    WHERE user_id = _user_id
      AND is_active = true
  )
$$;

-- 2) Backwards-compatible aliases so any policy still referencing the old
--    profiles.role-based helpers keeps working, now backed by public.admins.
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_active_admin(_user_id)
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_active_admin(auth.uid())
$$;

GRANT EXECUTE ON FUNCTION public.is_active_admin(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid)        TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_admin()            TO authenticated, anon;

-- 3) Admin read-all RLS policies for dashboard aggregates.
--    Patient-scoped policies remain untouched; these are additive SELECTs
--    that only broaden access for active admins.
DROP POLICY IF EXISTS "Admins can read all appointments" ON public.appointments;
CREATE POLICY "Admins can read all appointments"
  ON public.appointments
  FOR SELECT
  TO authenticated
  USING (public.is_active_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can read all payments" ON public.payments;
CREATE POLICY "Admins can read all payments"
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (public.is_active_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_active_admin(auth.uid()));

-- Verification (run manually as an active admin user):
--   select count(*) from public.appointments;
--   select count(*) from public.payments;
--   select count(*) from public.profiles;
-- Each count should match the totals visible to the service role.