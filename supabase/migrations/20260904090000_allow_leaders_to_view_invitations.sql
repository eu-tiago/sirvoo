-- Leaders need to see the invitations they create in the Users dialog.
CREATE POLICY "Church leaders can view invitations"
  ON public.invitations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.church_members
      WHERE church_members.church_id = invitations.church_id
        AND church_members.user_id = auth.uid()
        AND church_members.role IN ('admin', 'ministry_leader')
    )
  );