
-- Church-scoped safe profile directory (email/phone still masked for others)
DROP VIEW IF EXISTS public.safe_profiles;
CREATE VIEW public.safe_profiles
WITH (security_invoker = false) AS
SELECT
  p.id,
  p.full_name,
  p.avatar_url,
  p.created_at,
  p.updated_at,
  CASE WHEN p.id = auth.uid() THEN p.email ELSE NULL::text END AS email,
  CASE WHEN p.id = auth.uid() THEN p.phone ELSE NULL::text END AS phone
FROM public.profiles p
WHERE p.id = auth.uid() OR public.users_share_church_any(auth.uid(), p.id);

REVOKE ALL ON public.safe_profiles FROM PUBLIC, anon;
GRANT SELECT ON public.safe_profiles TO authenticated;
GRANT ALL ON public.safe_profiles TO service_role;

-- Church members can view all schedules of their church
DROP POLICY IF EXISTS "Church members can view church schedules" ON public.schedules;
CREATE POLICY "Church members can view church schedules"
ON public.schedules FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.ministries m
  WHERE m.id = schedules.ministry_id
    AND public.is_church_member(auth.uid(), m.church_id)
));

-- Church members can view assignments of their church schedules
DROP POLICY IF EXISTS "Church members can view church assignments" ON public.schedule_assignments;
CREATE POLICY "Church members can view church assignments"
ON public.schedule_assignments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.schedules s
  JOIN public.ministries m ON m.id = s.ministry_id
  WHERE s.id = schedule_assignments.schedule_id
    AND public.is_church_member(auth.uid(), m.church_id)
));
