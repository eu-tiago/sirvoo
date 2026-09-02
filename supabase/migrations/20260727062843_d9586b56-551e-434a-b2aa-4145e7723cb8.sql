
-- 1. Fix profiles email/phone exposure
DROP POLICY IF EXISTS "Church members can view each other basic profile" ON public.profiles;

-- 2. Remove broad listing SELECT policies on public storage buckets
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public can view SEO assets" ON storage.objects;

-- 3. Revoke EXECUTE on internal SECURITY DEFINER functions from anon/authenticated
-- Trigger-only functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_church_subscription() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_accept_pending_invitations() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_link_existing_profile_on_invite() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_schedule_reminders() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_schedule_reminders() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.regenerate_event_reminders() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM anon, authenticated;

-- Internal cron/queue helpers
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated;

-- Server-only notification helper
REVOKE EXECUTE ON FUNCTION public.send_notification(uuid, text, text, text, uuid) FROM anon;
