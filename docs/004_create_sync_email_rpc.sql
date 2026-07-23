-- MediCure — Create function to sync email when user updates auth.users.email
-- Apply this SQL on your EXTERNAL Supabase project (gvtjlfpzxyjbcaiyonnb)
-- from Supabase Studio → SQL editor.
--
-- This function is called from the client after an email update completes
-- in auth.users. It synchronizes the change to profiles.email.

CREATE OR REPLACE FUNCTION public.sync_profile_email_from_auth()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Only sync for the current authenticated user
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.profiles
  SET
    email = auth.users.email,
    updated_at = NOW()
  FROM auth.users
  WHERE public.profiles.id = auth.users.id
    AND auth.users.id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_profile_email_from_auth() TO authenticated;
