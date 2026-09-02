-- Allow church admins to manage ministries (insert, update, delete)
-- Note: Church admins can already manage via existing ALL policy

-- Allow church admins to manage ministry members
CREATE POLICY "Church admins can insert ministry members"
ON public.ministry_members
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM ministries m
    JOIN church_members cm ON cm.church_id = m.church_id
    WHERE m.id = ministry_members.ministry_id
    AND cm.user_id = auth.uid()
    AND cm.role = 'admin'
  )
);

CREATE POLICY "Church admins can update ministry members"
ON public.ministry_members
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM ministries m
    JOIN church_members cm ON cm.church_id = m.church_id
    WHERE m.id = ministry_members.ministry_id
    AND cm.user_id = auth.uid()
    AND cm.role = 'admin'
  )
);

CREATE POLICY "Church admins can delete ministry members"
ON public.ministry_members
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM ministries m
    JOIN church_members cm ON cm.church_id = m.church_id
    WHERE m.id = ministry_members.ministry_id
    AND cm.user_id = auth.uid()
    AND cm.role = 'admin'
  )
);

-- Allow church admins to manage ministry roles
CREATE POLICY "Church admins can insert ministry roles"
ON public.ministry_roles
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM ministries m
    JOIN church_members cm ON cm.church_id = m.church_id
    WHERE m.id = ministry_roles.ministry_id
    AND cm.user_id = auth.uid()
    AND cm.role = 'admin'
  )
);

CREATE POLICY "Church admins can update ministry roles"
ON public.ministry_roles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM ministries m
    JOIN church_members cm ON cm.church_id = m.church_id
    WHERE m.id = ministry_roles.ministry_id
    AND cm.user_id = auth.uid()
    AND cm.role = 'admin'
  )
);

CREATE POLICY "Church admins can delete ministry roles"
ON public.ministry_roles
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM ministries m
    JOIN church_members cm ON cm.church_id = m.church_id
    WHERE m.id = ministry_roles.ministry_id
    AND cm.user_id = auth.uid()
    AND cm.role = 'admin'
  )
);