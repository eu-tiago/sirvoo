
CREATE OR REPLACE FUNCTION public.users_share_church_any(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.church_members cm1
    JOIN public.church_members cm2 ON cm1.church_id = cm2.church_id
    WHERE cm1.user_id = _a AND cm2.user_id = _b
  )
$$;

DROP POLICY IF EXISTS "Church members can view each other basic profile" ON public.profiles;
CREATE POLICY "Church members can view each other basic profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.users_share_church_any(auth.uid(), id));
