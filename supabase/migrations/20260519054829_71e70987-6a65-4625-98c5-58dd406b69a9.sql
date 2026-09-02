
CREATE OR REPLACE FUNCTION public.get_invitation_email_statuses(_church_id uuid)
RETURNS TABLE(
  invitation_id uuid,
  message_id text,
  status text,
  error_message text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_church_admin(auth.uid(), _church_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  WITH latest AS (
    SELECT DISTINCT ON (l.message_id)
      l.message_id, l.status, l.error_message, l.created_at
    FROM public.email_send_log l
    WHERE l.template_name = 'church-invitation'
      AND l.message_id LIKE 'invite-%'
    ORDER BY l.message_id, l.created_at DESC
  )
  SELECT
    i.id AS invitation_id,
    latest.message_id,
    latest.status,
    latest.error_message,
    latest.created_at
  FROM public.invitations i
  JOIN latest
    ON latest.message_id LIKE ('invite-' || i.token || '%')
  WHERE i.church_id = _church_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invitation_email_statuses(uuid) TO authenticated;
