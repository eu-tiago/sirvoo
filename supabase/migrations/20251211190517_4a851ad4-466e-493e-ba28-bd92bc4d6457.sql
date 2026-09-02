-- Drop and recreate the INSERT policy for churches to ensure authenticated users can create
DROP POLICY IF EXISTS "Authenticated users can create churches" ON public.churches;

CREATE POLICY "Authenticated users can create churches"
ON public.churches
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by OR created_by IS NULL);