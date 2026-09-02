
-- Path format: {church_id}/{song_id}/{filename}
CREATE POLICY "worship_files_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'worship-files'
    AND public.is_church_member(auth.uid(), (split_part(name, '/', 1))::uuid)
  );

CREATE POLICY "worship_files_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'worship-files'
    AND (
      public.is_church_admin(auth.uid(), (split_part(name, '/', 1))::uuid)
      OR public.has_role(auth.uid(), 'ministry_leader')
    )
    AND public.is_church_member(auth.uid(), (split_part(name, '/', 1))::uuid)
  );

CREATE POLICY "worship_files_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'worship-files'
    AND (
      public.is_church_admin(auth.uid(), (split_part(name, '/', 1))::uuid)
      OR public.has_role(auth.uid(), 'ministry_leader')
    )
  );

CREATE POLICY "worship_files_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'worship-files'
    AND (
      public.is_church_admin(auth.uid(), (split_part(name, '/', 1))::uuid)
      OR public.has_role(auth.uid(), 'ministry_leader')
    )
  );
