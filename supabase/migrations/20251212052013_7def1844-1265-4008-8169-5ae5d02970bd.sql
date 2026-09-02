-- Fix the trigger function to handle duplicate subscriptions gracefully
CREATE OR REPLACE FUNCTION public.handle_new_church_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.church_subscriptions (church_id, plan, max_users)
  VALUES (NEW.id, 'free', 3)
  ON CONFLICT (church_id) DO NOTHING;
  RETURN NEW;
END;
$$;