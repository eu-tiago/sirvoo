-- Super admin check helper
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(coalesce((SELECT email FROM auth.users WHERE id = auth.uid()), '')) = 'tiagotalmud@gmail.com';
$$;

-- Broadcast history table
CREATE TABLE public.admin_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by uuid NOT NULL,
  segment text NOT NULL CHECK (segment IN ('all','free','premium')),
  channel text NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app','export')),
  title text NOT NULL,
  message text NOT NULL,
  cta text,
  recipients_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admin can view broadcasts"
ON public.admin_broadcasts FOR SELECT
TO authenticated
USING (public.is_super_admin());

CREATE POLICY "super admin can insert broadcasts"
ON public.admin_broadcasts FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin() AND sent_by = auth.uid());

CREATE INDEX idx_admin_broadcasts_created_at ON public.admin_broadcasts (created_at DESC);