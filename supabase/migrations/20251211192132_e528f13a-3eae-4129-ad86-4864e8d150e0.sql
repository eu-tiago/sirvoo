-- Drop all INSERT policies for churches and create a simpler one
DROP POLICY IF EXISTS "Authenticated users can create churches" ON public.churches;

-- Create a simple policy that allows any authenticated user to insert
CREATE POLICY "Authenticated users can create churches"
ON public.churches
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Also ensure the church_members insert policy works for self-insertion
DROP POLICY IF EXISTS "Users can insert themselves into churches" ON public.church_members;

CREATE POLICY "Users can insert themselves into churches"
ON public.church_members
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);