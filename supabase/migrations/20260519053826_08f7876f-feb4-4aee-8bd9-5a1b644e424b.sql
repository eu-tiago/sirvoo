-- 1. Remove privilege-escalation policy on user_roles
DROP POLICY IF EXISTS "Users can update their own role" ON public.user_roles;

-- 2. Recreate safe_profiles view with security_invoker so RLS on profiles applies
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
  CASE WHEN id = auth.uid() THEN email ELSE NULL::text END AS email,
  CASE WHEN id = auth.uid() THEN phone ELSE NULL::text END AS phone
FROM public.profiles;

GRANT SELECT ON public.safe_profiles TO authenticated, anon;

-- 3. Tighten churches INSERT policy: only self-attributed creations allowed
DROP POLICY IF EXISTS "Authenticated users can create churches" ON public.churches;
CREATE POLICY "Authenticated users can create churches"
ON public.churches
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- 4. Fix mutable search_path on update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;