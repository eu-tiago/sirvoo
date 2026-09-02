-- Fix 1: Allow users to update their own role (needed during onboarding when creating first church)
CREATE POLICY "Users can update their own role"
ON public.user_roles
FOR UPDATE
USING (auth.uid() = user_id);

-- Fix 2: Check if trigger exists for auto-creating church subscriptions
-- If not, create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_church_created'
  ) THEN
    CREATE TRIGGER on_church_created
      AFTER INSERT ON public.churches
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_church_subscription();
  END IF;
END$$;