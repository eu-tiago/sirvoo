ALTER TABLE public.schedule_assignments
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS checked_in_by uuid;

CREATE INDEX IF NOT EXISTS idx_schedule_assignments_checked_in_at
  ON public.schedule_assignments (checked_in_at);