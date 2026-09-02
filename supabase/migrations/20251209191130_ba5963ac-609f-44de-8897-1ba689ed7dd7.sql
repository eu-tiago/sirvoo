-- Create a SECURITY DEFINER function to send notifications
-- This allows the system to insert notifications without exposing INSERT to all users
CREATE OR REPLACE FUNCTION public.send_notification(
  _user_id uuid,
  _title text,
  _message text,
  _type text DEFAULT 'info',
  _related_schedule_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_id uuid;
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, related_schedule_id)
  VALUES (_user_id, _title, _message, _type, _related_schedule_id)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.send_notification TO authenticated;

-- Also allow users to delete their own notifications
CREATE POLICY "Users can delete their notifications"
ON public.notifications
FOR DELETE
USING (auth.uid() = user_id);