
-- Auto-link new profiles to any pending invitations with the same email
CREATE OR REPLACE FUNCTION public.auto_accept_pending_invitations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv record;
BEGIN
  FOR inv IN
    SELECT id, church_id, ministry_id, role, token
    FROM public.invitations
    WHERE lower(email) = lower(NEW.email)
      AND status = 'pending'
      AND (expires_at IS NULL OR expires_at > now())
  LOOP
    -- Create church membership (idempotent)
    INSERT INTO public.church_members (user_id, church_id, role)
    VALUES (NEW.id, inv.church_id, COALESCE(inv.role, 'volunteer'))
    ON CONFLICT (user_id, church_id) DO NOTHING;

    -- Sync user_roles
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, COALESCE(inv.role, 'volunteer')::app_role)
    ON CONFLICT DO NOTHING;

    -- Link to ministry if the invite specified one
    IF inv.ministry_id IS NOT NULL THEN
      INSERT INTO public.ministry_members (user_id, ministry_id)
      VALUES (NEW.id, inv.ministry_id)
      ON CONFLICT (user_id, ministry_id) DO NOTHING;
    END IF;

    -- Mark invite accepted
    UPDATE public.invitations
       SET status = 'accepted', accepted_at = now()
     WHERE id = inv.id;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_accept_invitations ON public.profiles;
CREATE TRIGGER trg_auto_accept_invitations
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.auto_accept_pending_invitations();

-- Backfill: link existing profiles that already have pending invitations
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.id AS user_id, i.id AS invitation_id, i.church_id, i.ministry_id, i.role
      FROM public.profiles p
      JOIN public.invitations i
        ON lower(i.email) = lower(p.email)
     WHERE i.status = 'pending'
       AND (i.expires_at IS NULL OR i.expires_at > now())
  LOOP
    INSERT INTO public.church_members (user_id, church_id, role)
    VALUES (r.user_id, r.church_id, COALESCE(r.role, 'volunteer'))
    ON CONFLICT (user_id, church_id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (r.user_id, COALESCE(r.role, 'volunteer')::app_role)
    ON CONFLICT DO NOTHING;

    IF r.ministry_id IS NOT NULL THEN
      INSERT INTO public.ministry_members (user_id, ministry_id)
      VALUES (r.user_id, r.ministry_id)
      ON CONFLICT (user_id, ministry_id) DO NOTHING;
    END IF;

    UPDATE public.invitations
       SET status = 'accepted', accepted_at = now()
     WHERE id = r.invitation_id;
  END LOOP;
END;
$$;
