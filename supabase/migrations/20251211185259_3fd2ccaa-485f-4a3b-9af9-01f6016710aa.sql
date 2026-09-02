-- 1. Recreate safe_profiles view with SECURITY INVOKER (fixes SECURITY DEFINER warning)
DROP VIEW IF EXISTS public.safe_profiles;

CREATE VIEW public.safe_profiles
WITH (security_invoker = true)
AS
SELECT 
  id,
  full_name,
  avatar_url,
  created_at,
  updated_at,
  CASE WHEN auth.uid() = id THEN email ELSE NULL END as email,
  CASE WHEN auth.uid() = id THEN phone ELSE NULL END as phone
FROM public.profiles;

-- 2. Add explicit deny policy for anonymous users on profiles table
CREATE POLICY "Deny anonymous access to profiles"
ON public.profiles
FOR SELECT
TO anon
USING (false);