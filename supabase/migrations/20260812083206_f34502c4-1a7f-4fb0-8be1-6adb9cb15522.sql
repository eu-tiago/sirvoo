CREATE TABLE IF NOT EXISTS public.recurring_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  ministry_id uuid NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role_id uuid REFERENCES public.ministry_roles(id) ON DELETE SET NULL,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  occurrence smallint NOT NULL CHECK (occurrence BETWEEN 1 AND 5),
  start_date date,
  end_date date,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_assignments TO authenticated;
GRANT ALL ON public.recurring_assignments TO service_role;

ALTER TABLE public.recurring_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Church members can view recurring assignments"
ON public.recurring_assignments FOR SELECT TO authenticated
USING (public.is_church_member(auth.uid(), church_id) OR public.is_super_admin());

CREATE POLICY "Leaders can insert recurring assignments"
ON public.recurring_assignments FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR public.is_church_admin(auth.uid(), church_id)
  OR public.is_church_leader(auth.uid(), church_id)
);

CREATE POLICY "Leaders can update recurring assignments"
ON public.recurring_assignments FOR UPDATE TO authenticated
USING (
  public.is_super_admin()
  OR public.is_church_admin(auth.uid(), church_id)
  OR public.is_church_leader(auth.uid(), church_id)
)
WITH CHECK (
  public.is_super_admin()
  OR public.is_church_admin(auth.uid(), church_id)
  OR public.is_church_leader(auth.uid(), church_id)
);

CREATE POLICY "Leaders can delete recurring assignments"
ON public.recurring_assignments FOR DELETE TO authenticated
USING (
  public.is_super_admin()
  OR public.is_church_admin(auth.uid(), church_id)
  OR public.is_church_leader(auth.uid(), church_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS recurring_assignments_unique_combo
ON public.recurring_assignments (
  church_id, ministry_id, user_id,
  COALESCE(role_id, '00000000-0000-0000-0000-000000000000'::uuid),
  weekday, occurrence
);

CREATE INDEX IF NOT EXISTS recurring_assignments_church_idx
  ON public.recurring_assignments (church_id, weekday, occurrence);

CREATE TRIGGER recurring_assignments_updated_at
BEFORE UPDATE ON public.recurring_assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- schedule_assignments: origin + original responsible
ALTER TABLE public.schedule_assignments
  ADD COLUMN IF NOT EXISTS recurring_id uuid REFERENCES public.recurring_assignments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS original_user_id uuid;

UPDATE public.schedule_assignments
   SET original_user_id = user_id
 WHERE original_user_id IS NULL;

CREATE OR REPLACE FUNCTION public.set_assignment_original_user()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.original_user_id IS NULL THEN
    NEW.original_user_id := NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_assignment_original_user
BEFORE INSERT ON public.schedule_assignments
FOR EACH ROW EXECUTE FUNCTION public.set_assignment_original_user();

-- Occurrence of the weekday within the month (1..5)
CREATE OR REPLACE FUNCTION public.occurrence_of_month(_d date)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ((EXTRACT(DAY FROM _d)::int - 1) / 7) + 1;
$$;

REVOKE ALL ON FUNCTION public.occurrence_of_month(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.occurrence_of_month(date) TO authenticated, service_role;

-- Apply recurring assignments to a given schedule (idempotent)
CREATE OR REPLACE FUNCTION public.apply_recurring_assignments(_schedule_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ministry_id uuid;
  _church_id uuid;
  _event_date date;
  _weekday int;
  _occ int;
  _inserted int := 0;
BEGIN
  SELECT s.ministry_id, m.church_id, e.event_date
    INTO _ministry_id, _church_id, _event_date
  FROM public.schedules s
  JOIN public.ministries m ON m.id = s.ministry_id
  JOIN public.events e ON e.id = s.event_id
  WHERE s.id = _schedule_id;

  IF _event_date IS NULL THEN
    RETURN 0;
  END IF;

  _weekday := EXTRACT(DOW FROM _event_date)::int;
  _occ := public.occurrence_of_month(_event_date);

  WITH ins AS (
    INSERT INTO public.schedule_assignments (schedule_id, user_id, role_id, status, recurring_id, original_user_id)
    SELECT _schedule_id, ra.user_id, ra.role_id, 'pending', ra.id, ra.user_id
    FROM public.recurring_assignments ra
    WHERE ra.church_id = _church_id
      AND ra.ministry_id = _ministry_id
      AND ra.weekday = _weekday
      AND ra.occurrence = _occ
      AND ra.active
      AND (ra.start_date IS NULL OR ra.start_date <= _event_date)
      AND (ra.end_date IS NULL OR ra.end_date >= _event_date)
      AND NOT EXISTS (
        SELECT 1 FROM public.schedule_assignments sa
        WHERE sa.schedule_id = _schedule_id
          AND (sa.user_id = ra.user_id OR sa.original_user_id = ra.user_id)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.volunteer_availability va
        WHERE va.user_id = ra.user_id
          AND va.is_available = false
          AND _event_date BETWEEN va.start_date AND va.end_date
      )
    RETURNING 1
  )
  SELECT count(*)::int INTO _inserted FROM ins;

  RETURN _inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_recurring_assignments(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_recurring_assignments(uuid) TO authenticated, service_role;

-- Trigger: new schedule gets its recurring people
CREATE OR REPLACE FUNCTION public.trg_apply_recurring_on_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.apply_recurring_assignments(NEW.id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_apply_recurring_on_schedule() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_schedules_apply_recurring
AFTER INSERT ON public.schedules
FOR EACH ROW EXECUTE FUNCTION public.trg_apply_recurring_on_schedule();

-- Trigger: event date change re-applies recurring rules for its schedules
CREATE OR REPLACE FUNCTION public.trg_apply_recurring_on_event_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
BEGIN
  IF NEW.event_date IS DISTINCT FROM OLD.event_date THEN
    FOR s IN SELECT id FROM public.schedules WHERE event_id = NEW.id LOOP
      PERFORM public.apply_recurring_assignments(s.id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_apply_recurring_on_event_date() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_events_apply_recurring
AFTER UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.trg_apply_recurring_on_event_date();

-- Sync recurring rules over an existing date range
CREATE OR REPLACE FUNCTION public.sync_recurring_for_range(_church_id uuid, _from date, _to date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
  _total int := 0;
BEGIN
  IF NOT (public.is_super_admin()
          OR public.is_church_admin(auth.uid(), _church_id)
          OR public.is_church_leader(auth.uid(), _church_id)) THEN
    RAISE EXCEPTION 'Sem permissao';
  END IF;

  FOR s IN
    SELECT sc.id
    FROM public.schedules sc
    JOIN public.events e ON e.id = sc.event_id
    WHERE e.church_id = _church_id
      AND e.event_date BETWEEN _from AND _to
  LOOP
    _total := _total + public.apply_recurring_assignments(s.id);
  END LOOP;

  RETURN _total;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_recurring_for_range(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_recurring_for_range(uuid, date, date) TO authenticated, service_role;