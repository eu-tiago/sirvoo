-- Allow ministry leaders and admins to insert schedules
CREATE POLICY "Ministry leaders can insert schedules"
ON public.schedules
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM ministry_members mm
    WHERE mm.ministry_id = schedules.ministry_id
    AND mm.user_id = auth.uid()
    AND mm.is_leader = true
  )
  OR
  EXISTS (
    SELECT 1 FROM ministries m
    JOIN church_members cm ON cm.church_id = m.church_id
    WHERE m.id = schedules.ministry_id
    AND cm.user_id = auth.uid()
    AND cm.role = 'admin'
  )
);

-- Allow ministry leaders and admins to update schedules
CREATE POLICY "Ministry leaders can update schedules"
ON public.schedules
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM ministry_members mm
    WHERE mm.ministry_id = schedules.ministry_id
    AND mm.user_id = auth.uid()
    AND mm.is_leader = true
  )
  OR
  EXISTS (
    SELECT 1 FROM ministries m
    JOIN church_members cm ON cm.church_id = m.church_id
    WHERE m.id = schedules.ministry_id
    AND cm.user_id = auth.uid()
    AND cm.role = 'admin'
  )
);

-- Allow ministry leaders and admins to delete schedules
CREATE POLICY "Ministry leaders can delete schedules"
ON public.schedules
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM ministry_members mm
    WHERE mm.ministry_id = schedules.ministry_id
    AND mm.user_id = auth.uid()
    AND mm.is_leader = true
  )
  OR
  EXISTS (
    SELECT 1 FROM ministries m
    JOIN church_members cm ON cm.church_id = m.church_id
    WHERE m.id = schedules.ministry_id
    AND cm.user_id = auth.uid()
    AND cm.role = 'admin'
  )
);

-- Allow ministry leaders and admins to insert schedule assignments
CREATE POLICY "Leaders can insert schedule assignments"
ON public.schedule_assignments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM schedules s
    JOIN ministry_members mm ON mm.ministry_id = s.ministry_id
    WHERE s.id = schedule_assignments.schedule_id
    AND mm.user_id = auth.uid()
    AND mm.is_leader = true
  )
  OR
  EXISTS (
    SELECT 1 FROM schedules s
    JOIN ministries m ON m.id = s.ministry_id
    JOIN church_members cm ON cm.church_id = m.church_id
    WHERE s.id = schedule_assignments.schedule_id
    AND cm.user_id = auth.uid()
    AND cm.role = 'admin'
  )
);

-- Allow ministry leaders and admins to delete schedule assignments
CREATE POLICY "Leaders can delete schedule assignments"
ON public.schedule_assignments
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM schedules s
    JOIN ministry_members mm ON mm.ministry_id = s.ministry_id
    WHERE s.id = schedule_assignments.schedule_id
    AND mm.user_id = auth.uid()
    AND mm.is_leader = true
  )
  OR
  EXISTS (
    SELECT 1 FROM schedules s
    JOIN ministries m ON m.id = s.ministry_id
    JOIN church_members cm ON cm.church_id = m.church_id
    WHERE s.id = schedule_assignments.schedule_id
    AND cm.user_id = auth.uid()
    AND cm.role = 'admin'
  )
);

-- Allow schedule members to view their schedule's assignments
CREATE POLICY "Schedule members can view schedule assignments"
ON public.schedule_assignments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM schedule_assignments sa
    WHERE sa.schedule_id = schedule_assignments.schedule_id
    AND sa.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM schedules s
    JOIN ministries m ON m.id = s.ministry_id
    JOIN church_members cm ON cm.church_id = m.church_id
    WHERE s.id = schedule_assignments.schedule_id
    AND cm.user_id = auth.uid()
    AND cm.role = 'admin'
  )
);