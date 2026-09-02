-- Drop ALL existing policies on churches and recreate them properly
DROP POLICY IF EXISTS "Authenticated users can create churches" ON public.churches;
DROP POLICY IF EXISTS "Church admins can delete their churches" ON public.churches;
DROP POLICY IF EXISTS "Church admins can update their churches" ON public.churches;
DROP POLICY IF EXISTS "Church members can view their churches" ON public.churches;

-- Create INSERT policy - allow any authenticated user to create churches
CREATE POLICY "Authenticated users can create churches"
ON public.churches
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create SELECT policy - members can view their churches
CREATE POLICY "Church members can view their churches"
ON public.churches
FOR SELECT
TO authenticated
USING (
  id IN (SELECT church_id FROM public.church_members WHERE user_id = auth.uid())
  OR created_by = auth.uid()
);

-- Create UPDATE policy - admins can update
CREATE POLICY "Church admins can update their churches"
ON public.churches
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.church_members
    WHERE church_members.church_id = churches.id
    AND church_members.user_id = auth.uid()
    AND church_members.role = 'admin'
  )
);

-- Create DELETE policy - admins can delete
CREATE POLICY "Church admins can delete their churches"
ON public.churches
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.church_members
    WHERE church_members.church_id = churches.id
    AND church_members.user_id = auth.uid()
    AND church_members.role = 'admin'
  )
);