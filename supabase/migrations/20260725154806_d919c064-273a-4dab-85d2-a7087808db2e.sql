CREATE OR REPLACE FUNCTION public.can_add_church_user(_church_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    -- Super admin bypass (caller)
    public.is_super_admin()
    -- Church has super admin as an admin member -> unlimited
    OR EXISTS (
      SELECT 1
      FROM public.church_members cm
      JOIN auth.users u ON u.id = cm.user_id
      WHERE cm.church_id = _church_id
        AND cm.role = 'admin'
        AND lower(u.email) = 'tiagotalmud@gmail.com'
    )
    -- Otherwise, check subscription limit
    OR COALESCE(
      (SELECT public.get_church_user_count(_church_id) < max_users
       FROM public.church_subscriptions
       WHERE church_id = _church_id),
      true
    );
$function$;