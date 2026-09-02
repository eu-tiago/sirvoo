
-- Fix infinite recursion: drop the self-referencing SELECT policy
DROP POLICY IF EXISTS "Schedule members can view schedule assignments" ON public.schedule_assignments;

-- Replace with a non-recursive policy using a security definer function
CREATE OR REPLACE FUNCTION public.is_schedule_member(_schedule_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.schedule_assignments
    WHERE schedule_id = _schedule_id
      AND user_id = _user_id
  )
$$;

-- Recreate the policy using the function
CREATE POLICY "Schedule members can view schedule assignments"
ON public.schedule_assignments
FOR SELECT
TO public
USING (
  is_schedule_member(schedule_id, auth.uid())
  OR EXISTS (
    SELECT 1
    FROM schedules s
    JOIN ministries m ON m.id = s.ministry_id
    JOIN church_members cm ON cm.church_id = m.church_id
    WHERE s.id = schedule_assignments.schedule_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'admin'::app_role
  )
);
