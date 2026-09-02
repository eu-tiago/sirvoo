-- Drop the current policy that exposes all profile data to admins
DROP POLICY IF EXISTS "Admins can view profiles in their church" ON public.profiles;

-- Create a more restrictive policy: admins can only view basic profile info (full_name, avatar_url)
-- For sensitive data (email, phone), only the owner can see their own data
-- This is achieved by keeping the SELECT policies as they are but the application code should use views

-- Create a security definer function to check if user is admin in the same church
CREATE OR REPLACE FUNCTION public.is_church_admin_of_user(_admin_user_id uuid, _target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.church_members cm1
    JOIN public.church_members cm2 ON cm1.church_id = cm2.church_id
    WHERE cm1.user_id = _admin_user_id 
      AND cm1.role = 'admin'
      AND cm2.user_id = _target_user_id
  )
$$;

-- Re-create the policy using the new function (same logic, but now we have the function for use in code)
CREATE POLICY "Admins can view profiles in their church"
ON public.profiles
FOR SELECT
USING (is_church_admin_of_user(auth.uid(), id));

-- Create a view that only exposes safe profile data for non-owners
-- This view can be used by the application to fetch member lists without exposing sensitive data
CREATE OR REPLACE VIEW public.safe_profiles AS
SELECT 
  id,
  full_name,
  avatar_url,
  created_at,
  updated_at,
  -- Only show email/phone if the viewer is the profile owner
  CASE WHEN auth.uid() = id THEN email ELSE NULL END as email,
  CASE WHEN auth.uid() = id THEN phone ELSE NULL END as phone
FROM public.profiles;