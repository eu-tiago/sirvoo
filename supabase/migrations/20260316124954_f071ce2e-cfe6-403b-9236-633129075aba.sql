
-- Table for schedule reminders
CREATE TABLE public.schedule_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.schedule_assignments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  schedule_id uuid NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  remind_at timestamp with time zone NOT NULL,
  reminder_type text NOT NULL DEFAULT 'before_event', -- 'two_days', 'one_day', 'same_day'
  sent boolean NOT NULL DEFAULT false,
  sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for efficient querying by the cron job
CREATE INDEX idx_schedule_reminders_pending ON public.schedule_reminders (remind_at, sent) WHERE sent = false;
CREATE INDEX idx_schedule_reminders_user ON public.schedule_reminders (user_id);
CREATE INDEX idx_schedule_reminders_assignment ON public.schedule_reminders (assignment_id);

-- Enable RLS
ALTER TABLE public.schedule_reminders ENABLE ROW LEVEL SECURITY;

-- Users can view their own reminders
CREATE POLICY "Users can view their own reminders" ON public.schedule_reminders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Users can update their own reminders (for toggling)
CREATE POLICY "Users can update their own reminders" ON public.schedule_reminders
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Users can delete their own reminders
CREATE POLICY "Users can delete their own reminders" ON public.schedule_reminders
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Add reminders_enabled to profiles
ALTER TABLE public.profiles ADD COLUMN reminders_enabled boolean NOT NULL DEFAULT true;

-- Function to auto-generate reminders when schedule assignments are created
CREATE OR REPLACE FUNCTION public.generate_schedule_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _event_date date;
  _start_time time;
  _event_id uuid;
  _event_timestamp timestamp with time zone;
BEGIN
  -- Get event info through the schedule
  SELECT e.event_date, e.start_time, e.id
  INTO _event_date, _start_time, _event_id
  FROM schedules s
  JOIN events e ON e.id = s.event_id
  WHERE s.id = NEW.schedule_id;

  IF _event_date IS NULL THEN
    RETURN NEW;
  END IF;

  _event_timestamp := (_event_date || ' ' || _start_time)::timestamp with time zone;

  -- Delete old reminders for this assignment (in case of update)
  DELETE FROM schedule_reminders WHERE assignment_id = NEW.id;

  -- Only create reminders for confirmed/pending assignments (not rejected)
  IF NEW.status NOT IN ('rejected', 'cancelled') THEN
    -- 2 days before (at 9am)
    IF _event_timestamp - interval '2 days' > now() THEN
      INSERT INTO schedule_reminders (assignment_id, user_id, schedule_id, event_id, remind_at, reminder_type)
      VALUES (NEW.id, NEW.user_id, NEW.schedule_id, _event_id,
              (_event_date - 2) + time '09:00:00', 'two_days');
    END IF;

    -- 1 day before (at 9am)
    IF _event_timestamp - interval '1 day' > now() THEN
      INSERT INTO schedule_reminders (assignment_id, user_id, schedule_id, event_id, remind_at, reminder_type)
      VALUES (NEW.id, NEW.user_id, NEW.schedule_id, _event_id,
              (_event_date - 1) + time '09:00:00', 'one_day');
    END IF;

    -- Same day (2 hours before event)
    IF _event_timestamp - interval '2 hours' > now() THEN
      INSERT INTO schedule_reminders (assignment_id, user_id, schedule_id, event_id, remind_at, reminder_type)
      VALUES (NEW.id, NEW.user_id, NEW.schedule_id, _event_id,
              _event_timestamp - interval '2 hours', 'same_day');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger on schedule_assignments insert/update
CREATE TRIGGER trigger_generate_reminders
  AFTER INSERT OR UPDATE ON public.schedule_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_schedule_reminders();

-- Function to clean reminders when assignment is deleted
CREATE OR REPLACE FUNCTION public.cleanup_schedule_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM schedule_reminders WHERE assignment_id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trigger_cleanup_reminders
  BEFORE DELETE ON public.schedule_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_schedule_reminders();

-- Also regenerate reminders when event dates change
CREATE OR REPLACE FUNCTION public.regenerate_event_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.event_date != NEW.event_date OR OLD.start_time != NEW.start_time THEN
    -- Delete all existing unsent reminders for schedules of this event
    DELETE FROM schedule_reminders 
    WHERE event_id = NEW.id AND sent = false;
    
    -- Re-insert reminders for all active assignments
    INSERT INTO schedule_reminders (assignment_id, user_id, schedule_id, event_id, remind_at, reminder_type)
    SELECT 
      sa.id,
      sa.user_id,
      sa.schedule_id,
      NEW.id,
      (NEW.event_date - 2) + time '09:00:00',
      'two_days'
    FROM schedule_assignments sa
    JOIN schedules s ON s.id = sa.schedule_id
    WHERE s.event_id = NEW.id
      AND sa.status NOT IN ('rejected', 'cancelled')
      AND (NEW.event_date - 2) + time '09:00:00' > now();

    INSERT INTO schedule_reminders (assignment_id, user_id, schedule_id, event_id, remind_at, reminder_type)
    SELECT 
      sa.id,
      sa.user_id,
      sa.schedule_id,
      NEW.id,
      (NEW.event_date - 1) + time '09:00:00',
      'one_day'
    FROM schedule_assignments sa
    JOIN schedules s ON s.id = sa.schedule_id
    WHERE s.event_id = NEW.id
      AND sa.status NOT IN ('rejected', 'cancelled')
      AND (NEW.event_date - 1) + time '09:00:00' > now();

    INSERT INTO schedule_reminders (assignment_id, user_id, schedule_id, event_id, remind_at, reminder_type)
    SELECT 
      sa.id,
      sa.user_id,
      sa.schedule_id,
      NEW.id,
      (NEW.event_date || ' ' || NEW.start_time)::timestamp with time zone - interval '2 hours',
      'same_day'
    FROM schedule_assignments sa
    JOIN schedules s ON s.id = sa.schedule_id
    WHERE s.event_id = NEW.id
      AND sa.status NOT IN ('rejected', 'cancelled')
      AND (NEW.event_date || ' ' || NEW.start_time)::timestamp with time zone - interval '2 hours' > now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_regenerate_event_reminders
  AFTER UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.regenerate_event_reminders();
