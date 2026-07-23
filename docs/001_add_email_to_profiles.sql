-- MediCure — Add email column to profiles table
-- Apply this SQL on your EXTERNAL Supabase project (gvtjlfpzxyjbcaiyonnb)
-- from Supabase Studio → SQL editor.

-- 1) Add email column to profiles table
ALTER TABLE public.profiles
ADD COLUMN email text;

-- 2) Create index for faster lookups
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);

-- 3) Create unique constraint (soft constraint via trigger-based validation)
-- We use a trigger instead of UNIQUE to handle NULLs properly and allow profile creation
-- before email is synced from auth.users
CREATE OR REPLACE FUNCTION public.validate_profiles_email_unique()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.profiles
      WHERE email = NEW.email AND id != NEW.id
    ) THEN
      RAISE EXCEPTION 'Email address already in use';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS profiles_email_unique_check ON public.profiles;
CREATE TRIGGER profiles_email_unique_check
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_profiles_email_unique();
