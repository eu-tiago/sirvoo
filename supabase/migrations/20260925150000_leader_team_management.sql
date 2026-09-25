-- All leader mutations use narrow RPCs; direct writes remain restricted to administrators.
CREATE FUNCTION public.can_manage_team_user(_target uuid, _church_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT auth.uid() IS NOT NULL AND _target <> auth.uid()
    AND NOT EXISTS (SELECT 1 FROM platform_admin WHERE user_id=_target)
    AND EXISTS (SELECT 1 FROM church_members WHERE church_id=_church_id AND user_id=_target AND role='volunteer')
    AND EXISTS (SELECT 1 FROM ministry_members mm JOIN ministries m ON m.id=mm.ministry_id
      WHERE mm.user_id=_target AND m.church_id=_church_id AND public.leads_ministry(m.id));
$$;

-- Explicit caller is private: only the trusted provisioning transaction may supply it.
CREATE FUNCTION public.may_create_church_user(_caller uuid,_church_id uuid,_role public.app_role,_ministries uuid[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT _caller IS NOT NULL AND _ministries IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM unnest(_ministries) AS teams(team_id) WHERE teams.team_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM ministries m WHERE m.id=teams.team_id AND m.church_id=_church_id))
    AND (EXISTS (SELECT 1 FROM platform_admin WHERE user_id=_caller)
      OR public.is_church_admin(_caller,_church_id)
      OR (_role='volunteer' AND cardinality(_ministries)>0
        AND EXISTS (SELECT 1 FROM church_members WHERE user_id=_caller AND church_id=_church_id AND role='ministry_leader')
        AND NOT EXISTS (SELECT 1 FROM unnest(_ministries) AS teams(team_id) WHERE NOT EXISTS (
          SELECT 1 FROM ministry_members mm WHERE mm.ministry_id=teams.team_id AND mm.user_id=_caller AND mm.is_leader))));
$$;
REVOKE ALL ON FUNCTION public.may_create_church_user(uuid,uuid,public.app_role,uuid[]) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.can_create_church_user(_church_id uuid,_role public.app_role,_ministries uuid[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.may_create_church_user(auth.uid(),_church_id,_role,_ministries);
$$;

CREATE FUNCTION public.provision_church_user(_caller uuid,_user_id uuid,_church_id uuid,_role public.app_role,_ministries uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM 1 FROM churches WHERE id=_church_id FOR UPDATE;
  IF NOT public.may_create_church_user(_caller,_church_id,_role,_ministries) THEN
    RAISE EXCEPTION 'Sem permissão para cadastrar nesta equipe';
  END IF;
  -- Never attach an existing member through this service-only creation operation.
  IF EXISTS (SELECT 1 FROM church_members WHERE user_id=_user_id) THEN
    RAISE EXCEPTION 'Usuário já vinculado';
  END IF;
  INSERT INTO church_members(church_id,user_id,role) VALUES (_church_id,_user_id,_role);
  INSERT INTO ministry_members(ministry_id,user_id,is_leader)
    SELECT DISTINCT id,_user_id,_role='ministry_leader' FROM unnest(_ministries) id;
  UPDATE profiles SET must_change_password=true WHERE id=_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.provision_church_user(uuid,uuid,uuid,public.app_role,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.provision_church_user(uuid,uuid,uuid,public.app_role,uuid[]) TO service_role;

CREATE FUNCTION public.edit_team_user(_target uuid,_church_id uuid,_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.can_manage_team_user(_target,_church_id) THEN RAISE EXCEPTION 'Sem permissão nesta equipe'; END IF;
  IF _name IS NULL OR length(trim(_name)) NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'Nome inválido'; END IF;
  UPDATE profiles SET full_name=trim(_name) WHERE id=_target;
END;
$$;

CREATE FUNCTION public.remove_team_user(_target uuid,_church_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _teams uuid[];
BEGIN
  IF NOT public.can_manage_team_user(_target,_church_id) THEN RAISE EXCEPTION 'Sem permissão nesta equipe'; END IF;
  SELECT array_agg(m.id) INTO _teams FROM ministries m WHERE m.church_id=_church_id AND public.leads_ministry(m.id);
  DELETE FROM schedule_assignments WHERE user_id=_target AND schedule_id IN (SELECT id FROM schedules WHERE ministry_id=ANY(_teams));
  DELETE FROM recurring_assignments WHERE user_id=_target AND ministry_id=ANY(_teams);
  DELETE FROM recurring_schedules WHERE user_id=_target AND ministry_id=ANY(_teams);
  DELETE FROM ministry_members WHERE user_id=_target AND ministry_id=ANY(_teams);
  -- Church membership and other teams survive; only a church admin can remove the church account.
END;
$$;
REVOKE ALL ON FUNCTION public.can_manage_team_user(uuid,uuid),public.can_create_church_user(uuid,public.app_role,uuid[]),public.edit_team_user(uuid,uuid,text),public.remove_team_user(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_manage_team_user(uuid,uuid),public.can_create_church_user(uuid,public.app_role,uuid[]),public.edit_team_user(uuid,uuid,text),public.remove_team_user(uuid,uuid) TO authenticated;
