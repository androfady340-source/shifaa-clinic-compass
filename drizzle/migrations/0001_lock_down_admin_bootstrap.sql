-- The original "first signup becomes admin" bootstrap was race-prone and
-- allowed any public registrant to become the clinic owner before the real owner.
-- Restrict the owner role to the designated account.

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND user_id = _user_id
      AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_owner boolean;
  spec uuid;
BEGIN
  is_owner := lower(coalesce(NEW.email, '')) = 'androfady340@gmail.com';

  IF is_owner THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'doctor')
  ON CONFLICT (user_id, role) DO NOTHING;

  BEGIN
    spec := nullif(NEW.raw_user_meta_data->>'specialty_id', '')::uuid;
  EXCEPTION WHEN others THEN
    spec := NULL;
  END;

  INSERT INTO public.doctors (id, full_name, phone, specialty_id, status)
  VALUES (
    NEW.id,
    left(coalesce(nullif(btrim(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1)), 100),
    left(coalesce(NEW.raw_user_meta_data->>'phone', ''), 20),
    spec,
    CASE WHEN is_owner THEN 'approved'::public.doctor_status ELSE 'pending'::public.doctor_status END
  );

  RETURN NEW;
END
$$;

-- If the designated owner already exists, make sure they retain admin access
-- and remove accidental admin grants created by the old first-signup rule.
DO $$
DECLARE
  owner_id uuid;
BEGIN
  SELECT id INTO owner_id
  FROM auth.users
  WHERE lower(email) = 'androfady340@gmail.com'
  LIMIT 1;

  IF owner_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (owner_id, 'admin'), (owner_id, 'doctor')
    ON CONFLICT (user_id, role) DO NOTHING;

    UPDATE public.doctors
    SET status = 'approved'
    WHERE id = owner_id;

    DELETE FROM public.user_roles ur
    USING auth.users u
    WHERE ur.user_id = u.id
      AND ur.role = 'admin'
      AND u.id <> owner_id;
  END IF;
END
$$;
