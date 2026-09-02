
-- ============================================
-- FIX 1: send_notification - add authorization check
-- Caller must share a church with the target user (or be service role)
-- ============================================
CREATE OR REPLACE FUNCTION public.send_notification(
  _user_id uuid,
  _title text,
  _message text,
  _type text DEFAULT 'info'::text,
  _related_schedule_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_id uuid;
  _caller_id uuid;
BEGIN
  _caller_id := auth.uid();

  -- If called by an authenticated user (not service role), verify authorization
  IF _caller_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.church_members cm1
      JOIN public.church_members cm2 ON cm1.church_id = cm2.church_id
      WHERE cm1.user_id = _caller_id
        AND cm2.user_id = _user_id
    ) THEN
      RAISE EXCEPTION 'Not authorized to send notification to this user';
    END IF;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, related_schedule_id)
  VALUES (_user_id, _title, _message, _type, _related_schedule_id)
  RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$;

-- ============================================
-- FIX 2: church_subscriptions - remove overly permissive INSERT policy
-- Service role (edge functions) bypasses RLS, so no replacement needed
-- ============================================
DROP POLICY IF EXISTS "System can insert subscriptions" ON public.church_subscriptions;

-- ============================================
-- FIX 3: safe_profiles - recreate with security_invoker
-- This ensures the view respects RLS on the profiles table
-- ============================================
DROP VIEW IF EXISTS public.safe_profiles;
CREATE VIEW public.safe_profiles
WITH (security_invoker = on) AS
  SELECT
    id,
    full_name,
    avatar_url,
    created_at,
    updated_at,
    CASE WHEN id = auth.uid() THEN email ELSE NULL END AS email,
    CASE WHEN id = auth.uid() THEN phone ELSE NULL END AS phone
  FROM public.profiles;
