
-- Fix 1: Prevent role escalation via church_members self-insert.
-- Restrict the self-insert path to the 'volunteer' role; admin assignment must go through
-- the "Church admins can manage members" path or the church creation flow.
DROP POLICY IF EXISTS "Users can insert themselves into churches" ON public.church_members;
CREATE POLICY "Users can insert themselves into churches"
ON public.church_members
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND role = 'volunteer'::app_role);

-- Fix 2: Lock down schedule_reminders INSERT to the owning user (or service role via DEFINER trigger).
CREATE POLICY "Users can insert their own reminders"
ON public.schedule_reminders
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Fix 3: Set immutable search_path on pgmq helper functions.
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
