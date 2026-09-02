-- 1. recurring_schedules: enable RLS + scoped policies
DROP POLICY IF EXISTS "Permitir acesso total para membros autenticados da igreja" ON public.recurring_schedules;
ALTER TABLE public.recurring_schedules ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.recurring_schedules FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_schedules TO authenticated;
GRANT ALL ON public.recurring_schedules TO service_role;

CREATE POLICY "Church members can view recurring schedules"
ON public.recurring_schedules FOR SELECT TO authenticated
USING (public.is_church_member(auth.uid(), church_id) OR public.is_super_admin());

CREATE POLICY "Managers can insert recurring schedules"
ON public.recurring_schedules FOR INSERT TO authenticated
WITH CHECK (public.is_church_admin(auth.uid(), church_id) OR public.is_church_leader(auth.uid(), church_id) OR public.is_super_admin());

CREATE POLICY "Managers can update recurring schedules"
ON public.recurring_schedules FOR UPDATE TO authenticated
USING (public.is_church_admin(auth.uid(), church_id) OR public.is_church_leader(auth.uid(), church_id) OR public.is_super_admin())
WITH CHECK (public.is_church_admin(auth.uid(), church_id) OR public.is_church_leader(auth.uid(), church_id) OR public.is_super_admin());

CREATE POLICY "Managers can delete recurring schedules"
ON public.recurring_schedules FOR DELETE TO authenticated
USING (public.is_church_admin(auth.uid(), church_id) OR public.is_church_leader(auth.uid(), church_id) OR public.is_super_admin());

-- 2. safe_profiles: remove SECURITY DEFINER view semantics
CREATE OR REPLACE FUNCTION public.list_safe_profiles()
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  created_at timestamptz,
  updated_at timestamptz,
  email text,
  phone text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.avatar_url, p.created_at, p.updated_at,
         CASE WHEN p.id = auth.uid() THEN p.email ELSE NULL END,
         CASE WHEN p.id = auth.uid() THEN p.phone ELSE NULL END
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND (p.id = auth.uid() OR public.users_share_church_any(auth.uid(), p.id));
$$;

REVOKE ALL ON FUNCTION public.list_safe_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_safe_profiles() TO authenticated, service_role;

DROP VIEW IF EXISTS public.safe_profiles;
CREATE VIEW public.safe_profiles WITH (security_invoker = true) AS
  SELECT * FROM public.list_safe_profiles();

REVOKE ALL ON public.safe_profiles FROM anon;
GRANT SELECT ON public.safe_profiles TO authenticated, service_role;