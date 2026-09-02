-- Create the trigger to automatically create subscription for new churches
DROP TRIGGER IF EXISTS on_church_created ON public.churches;

CREATE TRIGGER on_church_created
  AFTER INSERT ON public.churches
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_church_subscription();

-- Also add INSERT policy for church_subscriptions to allow trigger to work
DROP POLICY IF EXISTS "System can insert subscriptions" ON public.church_subscriptions;

CREATE POLICY "System can insert subscriptions"
ON public.church_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (true);