-- Settings module: clinic information + admin user management.
-- Apply on the external Supabase project used by the clinic app.
-- Safe to run multiple times.

------------------------------------------------------------------
-- 1) Admin roles on public.admins (single source of truth)
------------------------------------------------------------------
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'admin';
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admins_role_check'
  ) THEN
    ALTER TABLE public.admins
      ADD CONSTRAINT admins_role_check CHECK (role IN ('admin', 'super_admin'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS admins_user_id_key ON public.admins(user_id);

-- Promote the first existing admin to super_admin when none exists yet.
UPDATE public.admins
SET role = 'super_admin'
WHERE id = (
  SELECT id FROM public.admins ORDER BY created_at NULLS FIRST LIMIT 1
)
AND NOT EXISTS (SELECT 1 FROM public.admins WHERE role = 'super_admin');

CREATE OR REPLACE FUNCTION public.is_active_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = _user_id AND is_active = true)
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins
    WHERE user_id = _user_id AND is_active = true AND role = 'super_admin'
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_active_admin(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, anon;

------------------------------------------------------------------
-- 2) Clinic information (single row, id = 1)
------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clinic_settings (
  id            smallint PRIMARY KEY DEFAULT 1,
  name          text NOT NULL DEFAULT 'Vardhman Medicare',
  phone         text,
  email         text,
  website       text,
  address       text,
  working_hours text,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinic_settings_singleton CHECK (id = 1),
  CONSTRAINT clinic_settings_name_not_blank CHECK (length(btrim(name)) > 0)
);

GRANT SELECT ON public.clinic_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.clinic_settings TO authenticated;
GRANT ALL ON public.clinic_settings TO service_role;

ALTER TABLE public.clinic_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic settings are publicly readable" ON public.clinic_settings;
CREATE POLICY "Clinic settings are publicly readable"
  ON public.clinic_settings FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Admins can insert clinic settings" ON public.clinic_settings;
CREATE POLICY "Admins can insert clinic settings"
  ON public.clinic_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_active_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update clinic settings" ON public.clinic_settings;
CREATE POLICY "Admins can update clinic settings"
  ON public.clinic_settings FOR UPDATE TO authenticated
  USING (public.is_active_admin(auth.uid()))
  WITH CHECK (public.is_active_admin(auth.uid()));

INSERT INTO public.clinic_settings (id, name, phone, email, website, address, working_hours)
VALUES (1, 'Vardhman Medicare', '+91 98 0000 0000', 'contact@vardhmanivf.in',
        'https://vardhmanivf.in', 'Vardhman Medicare, India', 'Mon-Sat 09:00-20:00')
ON CONFLICT (id) DO NOTHING;

------------------------------------------------------------------
-- 3) Admin management RPCs (security definer, super-admin gated)
------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_admins()
RETURNS TABLE (
  id uuid, user_id uuid, full_name text, email text,
  role text, is_active boolean, created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_active_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  RETURN QUERY
  SELECT a.id, a.user_id,
         COALESCE(p.full_name, split_part(u.email, '@', 1))::text,
         COALESCE(p.email, u.email)::text,
         a.role, a.is_active, a.created_at
  FROM public.admins a
  LEFT JOIN auth.users u ON u.id = a.user_id
  LEFT JOIN public.profiles p ON p.id = a.user_id
  ORDER BY a.role DESC, a.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_admin_by_email(p_email text, p_role text DEFAULT 'admin')
RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid;
  v_id uuid;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF p_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'invalid_role';
  END IF;
  SELECT id INTO v_user FROM auth.users WHERE lower(email) = lower(btrim(p_email)) LIMIT 1;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;
  INSERT INTO public.admins (user_id, role, is_active)
  VALUES (v_user, p_role, true)
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, is_active = true
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_admin_role(p_admin_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF p_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'invalid_role';
  END IF;
  UPDATE public.admins SET role = p_role WHERE id = p_admin_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_admin_active(p_admin_id uuid, p_active boolean)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  SELECT user_id INTO v_user FROM public.admins WHERE id = p_admin_id;
  IF v_user = auth.uid() AND p_active = false THEN
    RAISE EXCEPTION 'cannot_disable_self';
  END IF;
  UPDATE public.admins SET is_active = p_active WHERE id = p_admin_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_remove_admin(p_admin_id uuid)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  SELECT user_id INTO v_user FROM public.admins WHERE id = p_admin_id;
  IF v_user = auth.uid() THEN
    RAISE EXCEPTION 'cannot_remove_self';
  END IF;
  DELETE FROM public.admins WHERE id = p_admin_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_admins() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_admin_by_email(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_admin_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_admin_active(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_admin(uuid) TO authenticated;
