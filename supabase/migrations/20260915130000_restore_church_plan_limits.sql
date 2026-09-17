INSERT INTO public.church_subscriptions (church_id, plan, max_users)
SELECT c.id, 'free', 3
FROM public.churches c
WHERE NOT EXISTS (
  SELECT 1
  FROM public.church_subscriptions cs
  WHERE cs.church_id = c.id
);

CREATE OR REPLACE FUNCTION public.can_add_church_user(_church_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.church_members cm
      JOIN auth.users u ON u.id = cm.user_id
      WHERE cm.church_id = _church_id
        AND cm.role = 'admin'
        AND lower(u.email) = 'tiagotalmud@gmail.com'
    )
    OR COALESCE(
      (
        SELECT public.get_church_user_count(_church_id) < cs.max_users
        FROM public.church_subscriptions cs
        WHERE cs.church_id = _church_id
      ),
      public.get_church_user_count(_church_id) < 3
    );
$$;