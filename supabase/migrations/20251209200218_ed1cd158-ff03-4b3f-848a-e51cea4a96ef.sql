-- Allow church admins to delete their churches
CREATE POLICY "Church admins can delete their churches"
ON public.churches
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM church_members
    WHERE church_members.church_id = churches.id
    AND church_members.user_id = auth.uid()
    AND church_members.role = 'admin'
  )
);