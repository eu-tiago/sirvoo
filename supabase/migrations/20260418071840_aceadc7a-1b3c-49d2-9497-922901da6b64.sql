DROP POLICY IF EXISTS "Super admin can upload SEO assets" ON storage.objects;
DROP POLICY IF EXISTS "Super admin can update SEO assets" ON storage.objects;
DROP POLICY IF EXISTS "Super admin can delete SEO assets" ON storage.objects;

CREATE POLICY "Super admin can upload SEO assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'seo-assets'
  AND (auth.jwt() ->> 'email') = 'tiagotalmud@gmail.com'
);

CREATE POLICY "Super admin can update SEO assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'seo-assets'
  AND (auth.jwt() ->> 'email') = 'tiagotalmud@gmail.com'
);

CREATE POLICY "Super admin can delete SEO assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'seo-assets'
  AND (auth.jwt() ->> 'email') = 'tiagotalmud@gmail.com'
);