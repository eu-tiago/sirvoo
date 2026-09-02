-- Fix can_add_church_user to handle churches without subscription yet (new churches)
CREATE OR REPLACE FUNCTION public.can_add_church_user(_church_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT get_church_user_count(_church_id) < max_users
     FROM public.church_subscriptions
     WHERE church_id = _church_id),
    true  -- Allow if no subscription exists yet (new church being created)
  )
$$;