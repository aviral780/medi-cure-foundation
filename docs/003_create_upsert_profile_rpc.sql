-- MediCure — Create function to sync profile email when user signs up
-- Apply this SQL on your EXTERNAL Supabase project (gvtjlfpzxyjbcaiyonnb)
-- from Supabase Studio → SQL editor.
--
-- This function is called from auth/onAuthStateChange in the app after
-- a successful signup to populate profiles.email for the new user.

CREATE OR REPLACE FUNCTION public.upsert_profile_with_email(
  p_user_id uuid,
  p_email text,
  p_full_name text DEFAULT NULL,
  p_phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  -- Ensure we have a user context
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Users can only create/update their own profile
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Upsert profile with email
  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (p_user_id, p_email, p_full_name, p_phone)
  ON CONFLICT (id) DO UPDATE
  SET
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    updated_at = NOW()
  RETURNING id INTO v_profile_id;

  RETURN v_profile_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_profile_with_email(uuid, text, text, text) TO authenticated;
