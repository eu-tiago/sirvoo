
-- Create invitations table
CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  church_id uuid NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL,
  email text NOT NULL,
  role public.app_role NOT NULL DEFAULT 'volunteer',
  ministry_id uuid REFERENCES public.ministries(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  accepted_by uuid,
  accepted_at timestamp with time zone,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Admins can view invitations for their church
CREATE POLICY "Church admins can view invitations"
  ON public.invitations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.church_members
      WHERE church_members.church_id = invitations.church_id
        AND church_members.user_id = auth.uid()
        AND church_members.role = 'admin'
    )
  );

-- Admins can insert invitations for their church
CREATE POLICY "Church admins can insert invitations"
  ON public.invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.church_members
      WHERE church_members.church_id = invitations.church_id
        AND church_members.user_id = auth.uid()
        AND church_members.role = 'admin'
    )
  );

-- Admins can update invitations for their church
CREATE POLICY "Church admins can update invitations"
  ON public.invitations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.church_members
      WHERE church_members.church_id = invitations.church_id
        AND church_members.user_id = auth.uid()
        AND church_members.role = 'admin'
    )
  );

-- Admins can delete invitations for their church
CREATE POLICY "Church admins can delete invitations"
  ON public.invitations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.church_members
      WHERE church_members.church_id = invitations.church_id
        AND church_members.user_id = auth.uid()
        AND church_members.role = 'admin'
    )
  );

-- Updated at trigger
CREATE TRIGGER update_invitations_updated_at
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
