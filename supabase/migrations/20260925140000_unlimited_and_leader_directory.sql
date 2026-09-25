-- Unlimited is a plan capability, never a comparison with a legacy numeric limit.
CREATE OR REPLACE FUNCTION public.can_add_church_user(_church_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE((SELECT CASE
    WHEN status IN ('active','trialing') AND plan='unlimited' THEN true
    WHEN status IN ('active','trialing') AND plan<>'free' THEN public.get_church_user_count(_church_id)<max_users
    ELSE public.get_church_user_count(_church_id)<3 END
    FROM public.church_subscriptions WHERE church_id=_church_id),public.get_church_user_count(_church_id)<3);
$$;

CREATE FUNCTION public.get_church_subscription(_church_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.church_subscriptions; active boolean; unlimited boolean; effective_plan text; capacity integer; members integer;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_super_admin() OR public.is_church_member(auth.uid(),_church_id)) THEN
    RAISE EXCEPTION 'Sem permissão nesta igreja';
  END IF;
  SELECT * INTO s FROM public.church_subscriptions WHERE church_id=_church_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assinatura não encontrada. Contate o administrador.'; END IF;
  active := COALESCE(s.status IN ('active','trialing'),false);
  effective_plan := CASE WHEN active THEN s.plan::text ELSE 'free' END;
  unlimited := effective_plan='unlimited';
  capacity := CASE WHEN unlimited THEN NULL WHEN effective_plan='free' THEN 3 ELSE s.max_users END;
  members := public.get_church_user_count(_church_id);
  RETURN jsonb_build_object('plan',effective_plan,'subscribed',active AND effective_plan<>'free',
    'max_users',capacity,'is_unlimited',unlimited,'current_users',members,
    'can_add_users',unlimited OR members<capacity,'subscription_end',s.current_period_end);
END $$;
REVOKE ALL ON FUNCTION public.get_church_subscription(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_church_subscription(uuid) TO authenticated;

CREATE FUNCTION public.leads_ministry(_ministry_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.ministry_members mm JOIN public.ministries m ON m.id=mm.ministry_id
    JOIN public.church_members cm ON cm.church_id=m.church_id AND cm.user_id=mm.user_id
    WHERE mm.ministry_id=_ministry_id AND mm.user_id=auth.uid() AND mm.is_leader AND cm.role='ministry_leader');
$$;
CREATE FUNCTION public.can_view_church_user(_target uuid,_church_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT _target=auth.uid() OR public.can_administer_church(_church_id) OR
    (public.is_church_member(auth.uid(),_church_id) AND (
      NOT public.is_church_leader(auth.uid(),_church_id) OR EXISTS (
        SELECT 1 FROM public.church_members cm JOIN public.ministry_members mm ON mm.user_id=cm.user_id
        JOIN public.ministries m ON m.id=mm.ministry_id AND m.church_id=cm.church_id
        WHERE cm.user_id=_target AND cm.church_id=_church_id AND cm.role='volunteer'
          AND public.leads_ministry(mm.ministry_id))));
$$;
CREATE FUNCTION public.can_view_user_profile(_target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT _target=auth.uid() OR public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.church_members cm WHERE cm.user_id=_target AND public.can_view_church_user(_target,cm.church_id));
$$;
REVOKE ALL ON FUNCTION public.leads_ministry(uuid),public.can_view_church_user(uuid,uuid),public.can_view_user_profile(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.leads_ministry(uuid),public.can_view_church_user(uuid,uuid),public.can_view_user_profile(uuid) TO authenticated;

-- Restrictive policies also constrain SELECT access implied by existing FOR ALL policies.
CREATE POLICY leader_directory_scope ON public.church_members AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.can_view_church_user(user_id,church_id));
CREATE POLICY leader_profile_scope ON public.profiles AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.can_view_user_profile(id));
CREATE POLICY leader_ministry_scope ON public.ministries AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.can_administer_church(church_id) OR NOT public.is_church_leader(auth.uid(),church_id) OR public.leads_ministry(id));
CREATE POLICY leader_team_scope ON public.ministry_members AS RESTRICTIVE FOR SELECT TO authenticated
USING (user_id=auth.uid() OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id=ministry_id
  AND public.can_view_church_user(user_id,m.church_id)));
CREATE POLICY leader_member_roles_scope ON public.member_roles AS RESTRICTIVE FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.ministry_members mm WHERE mm.id=member_id));
CREATE POLICY invitations_admin_scope ON public.invitations AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.can_administer_church(church_id));

-- Leaders cannot change membership or grant themselves leadership of another ministry.
DO $$ DECLARE item record; cmd text; expression text; BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('ministry_members','(SELECT church_id FROM public.ministries WHERE id=ministry_id)'),
    ('member_roles','(SELECT m.church_id FROM public.ministry_members mm JOIN public.ministries m ON m.id=mm.ministry_id WHERE mm.id=member_id)')
  ) x(tbl,tenant) LOOP
    expression := format('public.can_administer_church(%s)',item.tenant);
    EXECUTE format('CREATE POLICY members_admin_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (%s)',item.tbl,expression);
    EXECUTE format('CREATE POLICY members_admin_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',item.tbl,expression,expression);
    EXECUTE format('CREATE POLICY members_admin_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (%s)',item.tbl,expression);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.list_safe_profiles()
RETURNS TABLE(id uuid,full_name text,avatar_url text,created_at timestamptz,updated_at timestamptz,email text,phone text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT p.id,p.full_name,p.avatar_url,p.created_at,p.updated_at,
    CASE WHEN p.id=auth.uid() OR public.is_super_admin() THEN p.email ELSE NULL END,
    CASE WHEN p.id=auth.uid() OR public.is_super_admin() THEN p.phone ELSE NULL END
  FROM public.profiles p WHERE auth.uid() IS NOT NULL AND public.can_view_user_profile(p.id);
$$;
