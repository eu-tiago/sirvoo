-- Drop the existing restrictive insert policy
DROP POLICY IF EXISTS "Admins can insert churches" ON public.churches;

-- Create a permissive insert policy that allows authenticated users to create churches
-- The policy checks that created_by matches the authenticated user
CREATE POLICY "Authenticated users can create churches"
ON public.churches
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);