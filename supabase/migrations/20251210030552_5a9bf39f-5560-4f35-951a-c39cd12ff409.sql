-- Add INSERT, UPDATE, DELETE policies for member_roles table
-- Allow church admins to insert member roles
CREATE POLICY "Church admins can insert member roles"
ON public.member_roles FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM ministry_members mm
    JOIN ministries m ON m.id = mm.ministry_id
    JOIN church_members cm ON cm.church_id = m.church_id
    WHERE mm.id = member_roles.member_id
    AND cm.user_id = auth.uid()
    AND cm.role = 'admin'
  )
);

-- Allow church admins to update member roles
CREATE POLICY "Church admins can update member roles"
ON public.member_roles FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM ministry_members mm
    JOIN ministries m ON m.id = mm.ministry_id
    JOIN church_members cm ON cm.church_id = m.church_id
    WHERE mm.id = member_roles.member_id
    AND cm.user_id = auth.uid()
    AND cm.role = 'admin'
  )
);

-- Allow church admins to delete member roles
CREATE POLICY "Church admins can delete member roles"
ON public.member_roles FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM ministry_members mm
    JOIN ministries m ON m.id = mm.ministry_id
    JOIN church_members cm ON cm.church_id = m.church_id
    WHERE mm.id = member_roles.member_id
    AND cm.user_id = auth.uid()
    AND cm.role = 'admin'
  )
);

-- Allow ministry leaders to insert member roles for their ministry
CREATE POLICY "Ministry leaders can insert member roles"
ON public.member_roles FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM ministry_members mm
    JOIN ministry_members leader ON leader.ministry_id = mm.ministry_id
    WHERE mm.id = member_roles.member_id
    AND leader.user_id = auth.uid()
    AND leader.is_leader = true
  )
);

-- Allow ministry leaders to update member roles for their ministry
CREATE POLICY "Ministry leaders can update member roles"
ON public.member_roles FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM ministry_members mm
    JOIN ministry_members leader ON leader.ministry_id = mm.ministry_id
    WHERE mm.id = member_roles.member_id
    AND leader.user_id = auth.uid()
    AND leader.is_leader = true
  )
);

-- Allow ministry leaders to delete member roles for their ministry
CREATE POLICY "Ministry leaders can delete member roles"
ON public.member_roles FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM ministry_members mm
    JOIN ministry_members leader ON leader.ministry_id = mm.ministry_id
    WHERE mm.id = member_roles.member_id
    AND leader.user_id = auth.uid()
    AND leader.is_leader = true
  )
);