-- Keep recurring assignment times compatible with events.start_time (TIME).
DO $function$
DECLARE
  _data_type text;
BEGIN
  SELECT data_type
    INTO _data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'recurring_assignments'
    AND column_name = 'time';

  IF _data_type IS NULL THEN
    ALTER TABLE public.recurring_assignments ADD COLUMN "time" time;
  ELSIF _data_type <> 'time without time zone' THEN
    ALTER TABLE public.recurring_assignments
      ALTER COLUMN "time" DROP DEFAULT;
    ALTER TABLE public.recurring_assignments
      ALTER COLUMN "time" TYPE time
      USING NULLIF(BTRIM("time"::text), '')::time;
  END IF;
END;
$function$;

-- Recreate the assignment function after normalizing the column type.
-- This also fixes databases where the previous function version is still active.
CREATE OR REPLACE FUNCTION public.apply_recurring_assignments(_schedule_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _ministry_id uuid;
  _church_id uuid;
  _event_date date;
  _start_time time;
  _weekday int;
  _occ int;
  _eff int;
  _inserted int := 0;
BEGIN
  SELECT s.ministry_id, m.church_id, e.event_date, e.start_time
    INTO _ministry_id, _church_id, _event_date, _start_time
  FROM public.schedules s
  JOIN public.ministries m ON m.id = s.ministry_id
  JOIN public.events e ON e.id = s.event_id
  WHERE s.id = _schedule_id;

  IF _event_date IS NULL THEN
    RETURN 0;
  END IF;

  _weekday := EXTRACT(DOW FROM _event_date)::int;
  _occ := public.occurrence_of_month(_event_date);
  _eff := public.rotating_occurrence(_event_date);

  WITH ins AS (
    INSERT INTO public.schedule_assignments (schedule_id, user_id, role_id, status, recurring_id, original_user_id)
    SELECT _schedule_id, ra.user_id, ra.role_id, 'pending', ra.id, ra.user_id
    FROM public.recurring_assignments ra
    WHERE ra.church_id = _church_id
      AND ra.ministry_id = _ministry_id
      AND ra.weekday = _weekday
      AND (
        ra.occurrence = _eff
        OR (ra.occurrence = 5 AND _occ = 5)
      )
      AND (ra.time = _start_time OR ra.time IS NULL)
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
$function$;
