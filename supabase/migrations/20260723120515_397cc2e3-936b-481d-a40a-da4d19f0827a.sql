
CREATE OR REPLACE FUNCTION public.auto_link_existing_profile_on_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_user_id uuid;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO existing_user_id
  FROM public.profiles
  WHERE lower(email) = lower(NEW.email)
  LIMIT 1;

  IF existing_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.church_members (user_id, church_id, role)
  VALUES (existing_user_id, NEW.church_id, COALESCE(NEW.role, 'volunteer'))
  ON CONFLICT (user_id, church_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (existing_user_id, COALESCE(NEW.role, 'volunteer')::app_role)
  ON CONFLICT DO NOTHING;

  IF NEW.ministry_id IS NOT NULL THEN
    INSERT INTO public.ministry_members (user_id, ministry_id)
    VALUES (existing_user_id, NEW.ministry_id)
    ON CONFLICT (user_id, ministry_id) DO NOTHING;
  END IF;

  NEW.status := 'accepted';
  NEW.accepted_at := now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_link_existing_profile_on_invite ON public.invitations;
CREATE TRIGGER trg_auto_link_existing_profile_on_invite
BEFORE INSERT ON public.invitations
FOR EACH ROW
EXECUTE FUNCTION public.auto_link_existing_profile_on_invite();
