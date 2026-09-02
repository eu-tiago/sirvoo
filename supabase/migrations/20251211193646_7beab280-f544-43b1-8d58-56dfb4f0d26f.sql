-- Drop and recreate the INSERT policy as PERMISSIVE (default)
DROP POLICY IF EXISTS "Authenticated users can create churches" ON public.churches;

CREATE POLICY "Authenticated users can create churches"
ON public.churches
FOR INSERT
TO authenticated
WITH CHECK (true);