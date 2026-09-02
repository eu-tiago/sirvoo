-- Allow church admins to view all member_roles in their church
CREATE POLICY "Church admins can view member roles"
ON public.member_roles FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM ministry_members mm
    JOIN ministries m ON m.id = mm.ministry_id
    JOIN church_members cm ON cm.church_id = m.church_id
    WHERE mm.id = member_roles.member_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'admin'::app_role
  )
);

-- Allow ministry leaders to view member roles in their ministry
CREATE POLICY "Ministry leaders can view member roles"
ON public.member_roles FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM ministry_members mm
    JOIN ministry_members leader ON leader.ministry_id = mm.ministry_id
    WHERE mm.id = member_roles.member_id
      AND leader.user_id = auth.uid()
      AND leader.is_leader = true
  )
);