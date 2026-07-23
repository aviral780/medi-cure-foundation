-- MediCure — Backfill profiles.email from auth.users for existing users
-- Apply this SQL on your EXTERNAL Supabase project (gvtjlfpzxyjbcaiyonnb)
-- from Supabase Studio → SQL editor.
--
-- This backfill uses a security-definer function to access auth.users data
-- (since regular authenticated queries cannot read auth.users).

CREATE OR REPLACE FUNCTION public.backfill_profiles_email_from_auth()
RETURNS TABLE(total_updated int, users_with_profile int, users_without_profile int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_total_updated int := 0;
  v_with_profile int := 0;
  v_without_profile int := 0;
BEGIN
  -- Update existing profiles with email from auth.users
  UPDATE public.profiles
  SET email = auth.users.email
  FROM auth.users
  WHERE public.profiles.id = auth.users.id
    AND public.profiles.email IS NULL
    AND auth.users.email IS NOT NULL;
  
  GET DIAGNOSTICS v_total_updated = ROW_COUNT;
  
  -- Count profiles that now have email
  SELECT COUNT(*) INTO v_with_profile
  FROM public.profiles
  WHERE email IS NOT NULL;
  
  -- Count profiles without email (should be rare after backfill)
  SELECT COUNT(*) INTO v_without_profile
  FROM public.profiles
  WHERE email IS NULL;
  
  RETURN QUERY SELECT v_total_updated, v_with_profile, v_without_profile;
END;
$$;

-- Execute the backfill
-- Run this manually after applying the previous migration:
-- SELECT * FROM public.backfill_profiles_email_from_auth();
--
-- If you want to run it immediately (uncomment the line below):
-- SELECT public.backfill_profiles_email_from_auth();

GRANT EXECUTE ON FUNCTION public.backfill_profiles_email_from_auth() TO authenticated, service_role;
