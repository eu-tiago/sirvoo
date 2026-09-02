CREATE TABLE public.schedule_role_quotas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id uuid NOT NULL,
  role_id uuid,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 0 AND quantity <= 100),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (schedule_id, role_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_role_quotas TO authenticated;
GRANT ALL ON public.schedule_role_quotas TO service_role;

ALTER TABLE public.schedule_role_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view role quotas"
ON public.schedule_role_quotas FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.schedules s
    JOIN public.ministries m ON m.id = s.ministry_id
    JOIN public.church_members cm ON cm.church_id = m.church_id
    WHERE s.id = schedule_role_quotas.schedule_id
      AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Admins and leaders manage role quotas"
ON public.schedule_role_quotas FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.schedules s
    JOIN public.ministries m ON m.id = s.ministry_id
    LEFT JOIN public.church_members cm ON cm.church_id = m.church_id AND cm.user_id = auth.uid() AND cm.role = 'admin'
    LEFT JOIN public.ministry_members mm ON mm.ministry_id = s.ministry_id AND mm.user_id = auth.uid() AND mm.is_leader = true
    WHERE s.id = schedule_role_quotas.schedule_id
      AND (cm.id IS NOT NULL OR mm.id IS NOT NULL)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.schedules s
    JOIN public.ministries m ON m.id = s.ministry_id
    LEFT JOIN public.church_members cm ON cm.church_id = m.church_id AND cm.user_id = auth.uid() AND cm.role = 'admin'
    LEFT JOIN public.ministry_members mm ON mm.ministry_id = s.ministry_id AND mm.user_id = auth.uid() AND mm.is_leader = true
    WHERE s.id = schedule_role_quotas.schedule_id
      AND (cm.id IS NOT NULL OR mm.id IS NOT NULL)
  )
);