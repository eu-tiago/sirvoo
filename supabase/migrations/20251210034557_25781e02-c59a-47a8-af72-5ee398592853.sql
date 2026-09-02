-- Drop existing problematic SELECT policy
DROP POLICY IF EXISTS "Ministry members can view their ministry members" ON ministry_members;

-- Create a security definer function to check ministry membership without recursion
CREATE OR REPLACE FUNCTION public.is_ministry_member(_user_id uuid, _ministry_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ministry_members
    WHERE user_id = _user_id AND ministry_id = _ministry_id
  )
$$;

-- Create new SELECT policy using the security definer function
CREATE POLICY "Ministry members can view their ministry members"
ON ministry_members
FOR SELECT
USING (
  is_ministry_member(auth.uid(), ministry_id)
  OR EXISTS (
    SELECT 1
    FROM ministries m
    JOIN church_members cm ON cm.church_id = m.church_id
    WHERE m.id = ministry_members.ministry_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'admin'::app_role
  )
);