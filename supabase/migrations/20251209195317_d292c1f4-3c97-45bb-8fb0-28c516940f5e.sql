-- Drop existing admin policies that are too permissive
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update user roles" ON public.user_roles;

-- Create church-scoped policy for viewing profiles (admins see profiles of users in their church)
CREATE POLICY "Admins can view profiles in their church"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM church_members cm1
    JOIN church_members cm2 ON cm1.church_id = cm2.church_id
    WHERE cm1.user_id = auth.uid() 
    AND cm1.role = 'admin'
    AND cm2.user_id = profiles.id
  )
);

-- Create church-scoped policy for viewing user roles (admins see roles of users in their church)
CREATE POLICY "Admins can view user roles in their church"
ON public.user_roles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM church_members cm1
    JOIN church_members cm2 ON cm1.church_id = cm2.church_id
    WHERE cm1.user_id = auth.uid() 
    AND cm1.role = 'admin'
    AND cm2.user_id = user_roles.user_id
  )
);

-- Create church-scoped policy for updating user roles (admins can update roles of users in their church)
CREATE POLICY "Admins can update user roles in their church"
ON public.user_roles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM church_members cm1
    JOIN church_members cm2 ON cm1.church_id = cm2.church_id
    WHERE cm1.user_id = auth.uid() 
    AND cm1.role = 'admin'
    AND cm2.user_id = user_roles.user_id
  )
);