-- Ocorrência do dia da semana dentro do mês (1..5), corte no domingo
CREATE OR REPLACE FUNCTION public.occurrence_of_month(_d date)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT ((EXTRACT(DAY FROM _d)::int - 1) / 7) + 1;
$function$;

-- Rodízio contínuo de 4 equipes: em meses com 5 ocorrências a equipe 1 cobre a 5ª semana
-- e o ciclo continua deslocado no mês seguinte.
CREATE OR REPLACE FUNCTION public.rotating_occurrence(_d date)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT (((FLOOR((_d - DATE '2026-01-01') / 7.0)::int % 4) + 4) % 4) + 1;
$function$;

REVOKE ALL ON FUNCTION public.rotating_occurrence(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rotating_occurrence(date) TO authenticated, service_role;

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