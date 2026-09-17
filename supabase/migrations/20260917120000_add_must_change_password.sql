ALTER TABLE public.profiles
  ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;

UPDATE public.profiles
SET must_change_password = true;

CREATE OR REPLACE FUNCTION public.clear_password_change_requirement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET must_change_password = false,
      updated_at = now()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_password_requirement_bypass()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.must_change_password
    AND NOT NEW.must_change_password
    AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'A senha deve ser alterada antes de liberar o acesso';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_password_changed
  AFTER UPDATE OF encrypted_password ON auth.users
  FOR EACH ROW
  WHEN (OLD.encrypted_password IS DISTINCT FROM NEW.encrypted_password)
  EXECUTE FUNCTION public.clear_password_change_requirement();

CREATE TRIGGER protect_password_change_requirement
  BEFORE UPDATE OF must_change_password ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_password_requirement_bypass();

COMMENT ON COLUMN public.profiles.must_change_password IS
  'Requires the user to define a personal password before accessing protected routes.';
