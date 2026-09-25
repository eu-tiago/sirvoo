-- The singleton is provisioned by a database operator, never by a browser.
CREATE TABLE public.platform_admin (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT
);
ALTER TABLE public.platform_admin ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_admin FROM anon, authenticated;
GRANT ALL ON public.platform_admin TO service_role;
INSERT INTO public.platform_admin (user_id)
SELECT id FROM auth.users
WHERE lower(email) = 'tiagotalmud@gmail.com' AND email_confirmed_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admin WHERE user_id = auth.uid());
$$;

CREATE FUNCTION public.can_administer_church(_church_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin() OR public.is_church_admin(auth.uid(), _church_id);
$$;
CREATE FUNCTION public.can_manage_church(_church_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_administer_church(_church_id) OR public.is_church_leader(auth.uid(), _church_id);
$$;

-- Replace permissive legacy policies: a second permissive policy is an OR, not a limit.
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public'
    AND tablename IN ('churches', 'church_members', 'church_subscriptions', 'user_roles', 'profiles')
  LOOP EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename); END LOOP;
END $$;

CREATE POLICY church_read ON public.churches FOR SELECT TO authenticated
USING (public.is_super_admin() OR public.is_church_member(auth.uid(), id));
CREATE POLICY church_create ON public.churches FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY church_update ON public.churches FOR UPDATE TO authenticated
USING (public.can_administer_church(id)) WITH CHECK (public.can_administer_church(id));
CREATE POLICY church_delete ON public.churches FOR DELETE TO authenticated USING (public.is_super_admin());
CREATE POLICY members_read ON public.church_members FOR SELECT TO authenticated
USING (public.is_super_admin() OR public.is_church_member(auth.uid(), church_id));
CREATE POLICY members_update ON public.church_members FOR UPDATE TO authenticated
USING (public.can_administer_church(church_id)) WITH CHECK (public.can_administer_church(church_id));
CREATE POLICY members_delete ON public.church_members FOR DELETE TO authenticated USING (public.can_administer_church(church_id));
-- New accounts and accepted invitations enter through authorized server functions.
CREATE POLICY members_insert ON public.church_members FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY subscription_read ON public.church_subscriptions FOR SELECT TO authenticated
USING (public.is_super_admin() OR public.is_church_member(auth.uid(), church_id));
CREATE POLICY subscription_master ON public.church_subscriptions FOR ALL TO authenticated
USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY roles_read ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_super_admin());
CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_super_admin() OR public.users_share_church_any(auth.uid(), id));
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid() OR public.is_super_admin() OR public.is_church_admin_of_user(auth.uid(), id))
WITH CHECK (id = auth.uid() OR public.is_super_admin() OR public.is_church_admin_of_user(auth.uid(), id));
CREATE POLICY profiles_insert ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- Church and first administrator are created atomically; self-enrollment is forbidden.
CREATE FUNCTION public.create_church(_name text, _city text DEFAULT NULL, _state text DEFAULT NULL, _address text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE church uuid;
BEGIN
  IF auth.uid() IS NULL OR nullif(trim(_name), '') IS NULL THEN RAISE EXCEPTION 'Dados inválidos'; END IF;
  PERFORM 1 FROM auth.users WHERE id = auth.uid() FOR UPDATE;
  IF NOT public.is_super_admin() AND EXISTS (SELECT 1 FROM public.church_members WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Usuário já vinculado a uma igreja';
  END IF;
  INSERT INTO public.churches(name, city, state, address, created_by)
  VALUES (trim(_name), _city, _state, _address, auth.uid()) RETURNING id INTO church;
  INSERT INTO public.church_members(church_id, user_id, role) VALUES (church, auth.uid(), 'admin');
  RETURN church;
END $$;

DROP TRIGGER IF EXISTS on_church_created ON public.churches;
INSERT INTO public.church_subscriptions(church_id, plan, max_users)
SELECT id, 'free', 3 FROM public.churches ON CONFLICT (church_id) DO NOTHING;
UPDATE public.church_subscriptions SET max_users = 3 WHERE plan = 'free';
ALTER TABLE public.church_subscriptions ADD CONSTRAINT free_plan_limit CHECK (plan <> 'free' OR max_users = 3);
ALTER TABLE public.church_subscriptions ADD CONSTRAINT positive_user_limit CHECK (max_users > 0);

CREATE OR REPLACE FUNCTION public.can_add_church_user(_church_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.get_church_user_count(_church_id) < COALESCE((
    SELECT CASE WHEN plan = 'free' OR status NOT IN ('active', 'trialing') OR status IS NULL THEN 3 ELSE max_users END
    FROM public.church_subscriptions WHERE church_id = _church_id
  ), 3);
$$;
CREATE FUNCTION public.enforce_church_capacity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.church_id <> OLD.church_id OR NEW.user_id <> OLD.user_id THEN
      RAISE EXCEPTION 'Vínculos de igreja não podem ser transferidos';
    END IF;
    RETURN NEW;
  END IF;
  -- All insert paths (including service-role invitations) serialize on this row.
  PERFORM 1 FROM public.churches WHERE id = NEW.church_id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM public.church_members WHERE church_id = NEW.church_id AND user_id = NEW.user_id)
     AND NOT public.can_add_church_user(NEW.church_id) THEN
    RAISE EXCEPTION 'Limite de usuários atingido. Faça upgrade do plano.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER enforce_church_capacity BEFORE INSERT OR UPDATE ON public.church_members
FOR EACH ROW EXECUTE FUNCTION public.enforce_church_capacity();

CREATE OR REPLACE FUNCTION public.set_member_role(_user_id uuid, _church_id uuid, _role public.app_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_administer_church(_church_id) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  UPDATE public.church_members SET role = _role WHERE user_id = _user_id AND church_id = _church_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membro não encontrado'; END IF;
END $$;

-- Tenant-aware policies for every operational table, including indirect ownership.
DO $$ DECLARE item record; p record; reader text; writer text; BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('ministries', 'church_id', false),
    ('events', 'church_id', false),
    ('songs', 'church_id', false),
    ('song_files', 'church_id', false),
    ('playlists', 'church_id', false),
    ('playlist_songs', 'church_id', false),
    ('event_repertoire', 'church_id', false),
    ('recurring_assignments', 'church_id', false),
    ('recurring_schedules', 'church_id', false),
    ('invitations', 'church_id', true),
    ('ministry_roles', '(SELECT church_id FROM public.ministries WHERE id = ministry_id)', false),
    ('ministry_members', '(SELECT church_id FROM public.ministries WHERE id = ministry_id)', false),
    ('member_roles', '(SELECT m.church_id FROM public.ministry_members mm JOIN public.ministries m ON m.id = mm.ministry_id WHERE mm.id = member_id)', false),
    ('schedules', '(SELECT church_id FROM public.ministries WHERE id = ministry_id)', false),
    ('schedule_assignments', '(SELECT m.church_id FROM public.schedules s JOIN public.ministries m ON m.id = s.ministry_id WHERE s.id = schedule_id)', false),
    ('schedule_songs', '(SELECT m.church_id FROM public.schedules s JOIN public.ministries m ON m.id = s.ministry_id WHERE s.id = schedule_id)', false),
    ('schedule_role_quotas', '(SELECT m.church_id FROM public.schedules s JOIN public.ministries m ON m.id = s.ministry_id WHERE s.id = schedule_id)', false)
  ) AS x(tbl, tenant, admin_only) LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = item.tbl
    LOOP EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, item.tbl); END LOOP;
    reader := format('(public.is_super_admin() OR public.is_church_member(auth.uid(), %s))', item.tenant);
    IF item.tbl = 'invitations' THEN reader := format('public.can_manage_church(%s)', item.tenant); END IF;
    writer := format('public.%s(%s)', CASE WHEN item.admin_only THEN 'can_administer_church' ELSE 'can_manage_church' END, item.tenant);
    EXECUTE format('CREATE POLICY tenant_read ON public.%I FOR SELECT TO authenticated USING (%s)', item.tbl, reader);
    EXECUTE format('CREATE POLICY tenant_write ON public.%I FOR ALL TO authenticated USING (%s) WITH CHECK (%s)', item.tbl, writer, writer);
  END LOOP;
END $$;
CREATE POLICY assignment_self_update ON public.schedule_assignments FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

REVOKE ALL ON FUNCTION public.create_church(text,text,text,text), public.can_administer_church(uuid), public.can_manage_church(uuid), public.is_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_church(text,text,text,text), public.can_administer_church(uuid), public.can_manage_church(uuid), public.is_super_admin() TO authenticated, service_role;

-- Resolve inherited ownership without RLS recursion. Not exposed as an RPC.
CREATE FUNCTION public.row_church(_table text, _id uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result uuid;
BEGIN
  IF _table IN ('ministries','events','songs','playlists','recurring_assignments') THEN
    EXECUTE format('SELECT church_id FROM public.%I WHERE id = $1', _table) INTO result USING _id;
  ELSIF _table IN ('ministry_members','ministry_roles','schedules') THEN
    EXECUTE format('SELECT m.church_id FROM public.%I t JOIN public.ministries m ON m.id = t.ministry_id WHERE t.id = $1', _table) INTO result USING _id;
  ELSIF _table = 'schedule_assignments' THEN
    SELECT public.row_church('schedules', schedule_id) INTO result FROM public.schedule_assignments WHERE id = _id;
  END IF;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.row_church(text,uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.validate_tenant_links()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE doc jsonb := to_jsonb(NEW); tenant uuid := (doc->>'church_id')::uuid;
  link record; parent uuid; member uuid; ministry uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND doc ? 'church_id' AND doc->>'church_id' IS DISTINCT FROM to_jsonb(OLD)->>'church_id' THEN
    RAISE EXCEPTION 'A igreja do registro não pode ser alterada';
  END IF;
  FOR link IN SELECT * FROM (VALUES
    ('ministry_id','ministries'), ('event_id','events'), ('schedule_id','schedules'),
    ('song_id','songs'), ('playlist_id','playlists'), ('member_id','ministry_members'),
    ('role_id','ministry_roles'), ('recurring_id','recurring_assignments'),
    ('requester_assignment_id','schedule_assignments')
  ) AS x(field, tbl) LOOP
    IF doc->>link.field IS NOT NULL THEN
      parent := public.row_church(link.tbl, (doc->>link.field)::uuid);
      IF parent IS NULL THEN RAISE EXCEPTION 'Referência inválida: %', link.field; END IF;
      IF tenant IS NOT NULL AND tenant <> parent THEN RAISE EXCEPTION 'Referências de igrejas diferentes'; END IF;
      tenant := parent;
    END IF;
  END LOOP;
  FOREACH member IN ARRAY ARRAY[(doc->>'user_id')::uuid, (doc->>'requester_id')::uuid, (doc->>'requested_id')::uuid] LOOP
    IF member IS NOT NULL AND NOT public.is_church_member(member, tenant) THEN
      RAISE EXCEPTION 'Usuário não pertence à igreja';
    END IF;
  END LOOP;
  ministry := (doc->>'ministry_id')::uuid;
  IF doc->>'schedule_id' IS NOT NULL THEN SELECT ministry_id INTO ministry FROM public.schedules WHERE id = (doc->>'schedule_id')::uuid; END IF;
  IF doc->>'member_id' IS NOT NULL THEN SELECT ministry_id INTO ministry FROM public.ministry_members WHERE id = (doc->>'member_id')::uuid; END IF;
  IF ministry IS NOT NULL AND doc->>'role_id' IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.ministry_roles WHERE id = (doc->>'role_id')::uuid AND ministry_id = ministry
  ) THEN RAISE EXCEPTION 'Função não pertence ao ministério'; END IF;
  IF TG_TABLE_NAME = 'swap_requests' AND NOT EXISTS (
    SELECT 1 FROM public.schedule_assignments WHERE id = (doc->>'requester_assignment_id')::uuid
    AND user_id = (doc->>'requester_id')::uuid AND schedule_id = (doc->>'schedule_id')::uuid
  ) THEN RAISE EXCEPTION 'Solicitação de troca inválida'; END IF;
  IF TG_OP = 'UPDATE' AND auth.uid() IS NOT NULL AND NOT public.can_manage_church(tenant) THEN
    IF TG_TABLE_NAME = 'schedule_assignments' AND
      (doc - ARRAY['status','confirmed_at','notes','checked_in_at','checked_in_by','substitution_reason','substitution_status','updated_at'])
      IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','confirmed_at','notes','checked_in_at','checked_in_by','substitution_reason','substitution_status','updated_at'])
    THEN
      -- The accepted swap RPC may transfer exactly this assignment to its recipient.
      IF NOT (NEW.user_id = auth.uid() AND EXISTS (
        SELECT 1 FROM public.swap_requests r WHERE r.requester_assignment_id = NEW.id
        AND r.requester_id = OLD.user_id AND r.requested_id = NEW.user_id AND r.status = 'accepted'
      ) AND (doc - ARRAY['user_id','status','confirmed_at','notes','updated_at'])
        IS NOT DISTINCT FROM (to_jsonb(OLD) - ARRAY['user_id','status','confirmed_at','notes','updated_at']))
      THEN RAISE EXCEPTION 'Sem permissão para alterar vínculos da escala'; END IF;
    END IF;
    IF TG_TABLE_NAME = 'swap_requests' AND (doc - ARRAY['status','updated_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','updated_at'])
    THEN RAISE EXCEPTION 'Sem permissão para alterar vínculos da troca'; END IF;
  END IF;
  RETURN NEW;
END $$;
DO $$ DECLARE tbl text; BEGIN
  FOREACH tbl IN ARRAY ARRAY['ministries','events','songs','playlists','song_files','playlist_songs','event_repertoire',
    'recurring_assignments','recurring_schedules','ministry_members','ministry_roles','member_roles','schedules',
    'schedule_assignments','schedule_songs','schedule_role_quotas','invitations','swap_requests'] LOOP
    EXECUTE format('CREATE TRIGGER a_validate_tenant_links BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_links()', tbl);
  END LOOP;
END $$;

-- Invitations must be accepted by the authenticated recipient, not a mutable profile email.
DROP TRIGGER IF EXISTS trg_auto_accept_invitations ON public.profiles;
DROP TRIGGER IF EXISTS trg_auto_link_existing_profile_on_invite ON public.invitations;

DROP POLICY IF EXISTS worship_files_select ON storage.objects;
DROP POLICY IF EXISTS worship_files_write ON storage.objects;
DROP POLICY IF EXISTS worship_files_update ON storage.objects;
DROP POLICY IF EXISTS worship_files_delete ON storage.objects;
CREATE POLICY worship_files_select ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'worship-files' AND (public.is_super_admin() OR public.is_church_member(auth.uid(), split_part(name,'/',1)::uuid)));
CREATE POLICY worship_files_manage ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'worship-files' AND public.can_manage_church(split_part(name,'/',1)::uuid))
WITH CHECK (bucket_id = 'worship-files' AND public.can_manage_church(split_part(name,'/',1)::uuid));
REVOKE EXECUTE ON FUNCTION public.apply_recurring_assignments(uuid) FROM PUBLIC, anon, authenticated;

DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='swap_requests'
  LOOP EXECUTE format('DROP POLICY %I ON public.swap_requests',p.policyname); END LOOP;
END $$;
CREATE POLICY swaps_read ON public.swap_requests FOR SELECT TO authenticated USING (
  public.is_super_admin() OR EXISTS (SELECT 1 FROM public.schedules s JOIN public.ministries m ON m.id=s.ministry_id
    WHERE s.id=swap_requests.schedule_id AND public.is_church_member(auth.uid(),m.church_id)));
CREATE POLICY swaps_insert ON public.swap_requests FOR INSERT TO authenticated WITH CHECK (requester_id=auth.uid() AND status='pending');
CREATE POLICY swaps_delete ON public.swap_requests FOR DELETE TO authenticated USING (requester_id=auth.uid() AND status='pending');
CREATE FUNCTION public.respond_to_swap(_request_id uuid, _accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.swap_requests; church uuid;
BEGIN
  SELECT * INTO r FROM public.swap_requests WHERE id=_request_id FOR UPDATE;
  IF NOT FOUND OR r.status <> 'pending' OR auth.uid() IS DISTINCT FROM r.requested_id THEN RAISE EXCEPTION 'Troca indisponível'; END IF;
  church := public.row_church('schedules',r.schedule_id);
  IF NOT public.is_church_member(auth.uid(),church) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  PERFORM 1 FROM public.schedule_assignments WHERE id=r.requester_assignment_id AND user_id=r.requester_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Escala alterada'; END IF;
  UPDATE public.swap_requests SET status=CASE WHEN _accept THEN 'accepted' ELSE 'rejected' END, updated_at=now() WHERE id=r.id;
  IF _accept THEN
    UPDATE public.schedule_assignments SET user_id=auth.uid(),status='confirmed',confirmed_at=now(),notes='Troca aceita' WHERE id=r.requester_assignment_id;
  ELSE
    UPDATE public.schedule_assignments SET status='pending',notes=NULL WHERE id=r.requester_assignment_id;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.respond_to_swap(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.respond_to_swap(uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_safe_profiles()
RETURNS TABLE(id uuid,full_name text,avatar_url text,created_at timestamptz,updated_at timestamptz,email text,phone text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT p.id,p.full_name,p.avatar_url,p.created_at,p.updated_at,
    CASE WHEN p.id=auth.uid() OR public.is_super_admin() THEN p.email ELSE NULL END,
    CASE WHEN p.id=auth.uid() OR public.is_super_admin() THEN p.phone ELSE NULL END
  FROM public.profiles p WHERE auth.uid() IS NOT NULL AND
    (p.id=auth.uid() OR public.is_super_admin() OR public.users_share_church_any(auth.uid(),p.id));
$$;
REVOKE ALL ON FUNCTION public.list_safe_profiles() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_safe_profiles() TO authenticated,service_role;
