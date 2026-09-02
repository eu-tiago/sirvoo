
-- Helper: is the user a ministry leader in this church?
CREATE OR REPLACE FUNCTION public.is_church_leader(_user_id uuid, _church_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.church_members
    WHERE user_id = _user_id AND church_id = _church_id AND role = 'ministry_leader'
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_church_leader(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_church_leader(uuid, uuid) TO authenticated;

-- Helper: is the caller a leader of a church the target user belongs to?
CREATE OR REPLACE FUNCTION public.is_church_leader_of_user(_leader_id uuid, _target_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.church_members cm1
    JOIN public.church_members cm2 ON cm1.church_id = cm2.church_id
    WHERE cm1.user_id = _leader_id
      AND cm1.role = 'ministry_leader'
      AND cm2.user_id = _target_user_id
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_church_leader_of_user(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_church_leader_of_user(uuid, uuid) TO authenticated;

-- Safe role change (fixes duplicate key errors on user_roles)
CREATE OR REPLACE FUNCTION public.set_member_role(_user_id uuid, _church_id uuid, _role app_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _caller uuid := auth.uid();
  _caller_role app_role;
  _target_role app_role;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  SELECT role INTO _caller_role FROM public.church_members
   WHERE user_id = _caller AND church_id = _church_id;

  IF NOT public.is_super_admin()
     AND COALESCE(_caller_role::text, '') NOT IN ('admin', 'ministry_leader') THEN
    RAISE EXCEPTION 'Sem permissao para alterar funcoes';
  END IF;

  SELECT role INTO _target_role FROM public.church_members
   WHERE user_id = _user_id AND church_id = _church_id;

  IF _target_role IS NULL THEN
    RAISE EXCEPTION 'Usuario nao pertence a esta igreja';
  END IF;

  IF NOT public.is_super_admin()
     AND _caller_role = 'ministry_leader'
     AND ('admin' IN (_role::text, _target_role::text)) THEN
    RAISE EXCEPTION 'Lideres nao podem gerenciar administradores';
  END IF;

  UPDATE public.church_members SET role = _role
   WHERE user_id = _user_id AND church_id = _church_id;

  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role)
  ON CONFLICT DO NOTHING;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_member_role(uuid, uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_member_role(uuid, uuid, app_role) TO authenticated;

-- Leaders can manage non-admin members of their church
DROP POLICY IF EXISTS "Leaders can manage non-admin members" ON public.church_members;
CREATE POLICY "Leaders can manage non-admin members"
ON public.church_members FOR ALL TO authenticated
USING (public.is_church_leader(auth.uid(), church_id) AND role <> 'admin')
WITH CHECK (public.is_church_leader(auth.uid(), church_id) AND role <> 'admin');

-- Leaders can view profiles of members in their church
DROP POLICY IF EXISTS "Leaders can view profiles in their church" ON public.profiles;
CREATE POLICY "Leaders can view profiles in their church"
ON public.profiles FOR SELECT TO authenticated
USING (public.is_church_leader_of_user(auth.uid(), id));

-- Admins and leaders can update member profile data (name/avatar)
DROP POLICY IF EXISTS "Church managers can update member profiles" ON public.profiles;
CREATE POLICY "Church managers can update member profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (public.is_church_admin_of_user(auth.uid(), id) OR public.is_church_leader_of_user(auth.uid(), id))
WITH CHECK (public.is_church_admin_of_user(auth.uid(), id) OR public.is_church_leader_of_user(auth.uid(), id));
