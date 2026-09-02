-- Allow church leaders (ministry_leader role) to create/manage events, schedules, quotas and assignments

-- 1) EVENTS: widen manage policy to admins + ministry_leaders + super admin
DROP POLICY IF EXISTS "Church admins can manage events" ON public.events;
CREATE POLICY "Church managers can manage events"
  ON public.events
  FOR ALL
  TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.church_members cm
      WHERE cm.church_id = events.church_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin','ministry_leader')
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.church_members cm
      WHERE cm.church_id = events.church_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin','ministry_leader')
    )
  );

-- 2) SCHEDULES: allow church-level ministry_leader to insert/update/delete
DROP POLICY IF EXISTS "Ministry leaders can insert schedules" ON public.schedules;
CREATE POLICY "Managers can insert schedules"
  ON public.schedules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      JOIN public.church_members cm ON cm.church_id = m.church_id
      WHERE m.id = schedules.ministry_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin','ministry_leader')
    )
    OR EXISTS (
      SELECT 1 FROM public.ministry_members mm
      WHERE mm.ministry_id = schedules.ministry_id
        AND mm.user_id = auth.uid()
        AND mm.is_leader = true
    )
  );

DROP POLICY IF EXISTS "Ministry leaders can update schedules" ON public.schedules;
CREATE POLICY "Managers can update schedules"
  ON public.schedules
  FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      JOIN public.church_members cm ON cm.church_id = m.church_id
      WHERE m.id = schedules.ministry_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin','ministry_leader')
    )
    OR EXISTS (
      SELECT 1 FROM public.ministry_members mm
      WHERE mm.ministry_id = schedules.ministry_id
        AND mm.user_id = auth.uid()
        AND mm.is_leader = true
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      JOIN public.church_members cm ON cm.church_id = m.church_id
      WHERE m.id = schedules.ministry_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin','ministry_leader')
    )
    OR EXISTS (
      SELECT 1 FROM public.ministry_members mm
      WHERE mm.ministry_id = schedules.ministry_id
        AND mm.user_id = auth.uid()
        AND mm.is_leader = true
    )
  );

DROP POLICY IF EXISTS "Ministry leaders can delete schedules" ON public.schedules;
CREATE POLICY "Managers can delete schedules"
  ON public.schedules
  FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      JOIN public.church_members cm ON cm.church_id = m.church_id
      WHERE m.id = schedules.ministry_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin','ministry_leader')
    )
    OR EXISTS (
      SELECT 1 FROM public.ministry_members mm
      WHERE mm.ministry_id = schedules.ministry_id
        AND mm.user_id = auth.uid()
        AND mm.is_leader = true
    )
  );

-- 3) SCHEDULE ROLE QUOTAS: allow church-level ministry_leader
DROP POLICY IF EXISTS "Admins and leaders manage role quotas" ON public.schedule_role_quotas;
CREATE POLICY "Managers manage role quotas"
  ON public.schedule_role_quotas
  FOR ALL
  TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.schedules s
      JOIN public.ministries m ON m.id = s.ministry_id
      JOIN public.church_members cm ON cm.church_id = m.church_id
      WHERE s.id = schedule_role_quotas.schedule_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin','ministry_leader')
    )
    OR EXISTS (
      SELECT 1 FROM public.schedules s
      JOIN public.ministry_members mm ON mm.ministry_id = s.ministry_id
      WHERE s.id = schedule_role_quotas.schedule_id
        AND mm.user_id = auth.uid()
        AND mm.is_leader = true
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.schedules s
      JOIN public.ministries m ON m.id = s.ministry_id
      JOIN public.church_members cm ON cm.church_id = m.church_id
      WHERE s.id = schedule_role_quotas.schedule_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin','ministry_leader')
    )
    OR EXISTS (
      SELECT 1 FROM public.schedules s
      JOIN public.ministry_members mm ON mm.ministry_id = s.ministry_id
      WHERE s.id = schedule_role_quotas.schedule_id
        AND mm.user_id = auth.uid()
        AND mm.is_leader = true
    )
  );

-- 4) SCHEDULE ASSIGNMENTS INSERT: allow church-level ministry_leader
DROP POLICY IF EXISTS "Leaders can insert schedule assignments" ON public.schedule_assignments;
CREATE POLICY "Managers can insert schedule assignments"
  ON public.schedule_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.schedules s
      JOIN public.ministries m ON m.id = s.ministry_id
      JOIN public.church_members cm ON cm.church_id = m.church_id
      WHERE s.id = schedule_assignments.schedule_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin','ministry_leader')
    )
    OR EXISTS (
      SELECT 1 FROM public.schedules s
      JOIN public.ministry_members mm ON mm.ministry_id = s.ministry_id
      WHERE s.id = schedule_assignments.schedule_id
        AND mm.user_id = auth.uid()
        AND mm.is_leader = true
    )
  );