-- Trigger-only functions: no direct execution by API roles
REVOKE ALL ON FUNCTION public.auto_accept_pending_invitations() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.auto_link_existing_profile_on_invite() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.cleanup_schedule_reminders() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.generate_schedule_reminders() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.regenerate_event_reminders() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.handle_new_church_subscription() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;

-- Internal helpers not called by clients
REVOKE ALL ON FUNCTION public.get_church_user_count(uuid) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.users_share_church_any(uuid, uuid) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.users_share_church(uuid, uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.is_church_admin_of_user(uuid, uuid) FROM anon, public;

-- Policy/RPC helpers: signed-in users only, never anonymous
REVOKE ALL ON FUNCTION public.can_add_church_user(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.get_user_church_ids(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE ALL ON FUNCTION public.is_church_admin(uuid, uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.is_church_member(uuid, uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.is_ministry_member(uuid, uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.is_schedule_member(uuid, uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM anon, public;
REVOKE ALL ON FUNCTION public.get_invitation_email_statuses(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.send_notification(uuid, text, text, text, uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.can_add_church_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_church_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_church_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_church_admin_of_user(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_church_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_ministry_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_schedule_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.users_share_church(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invitation_email_statuses(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_notification(uuid, text, text, text, uuid) TO authenticated;

-- service_role keeps full access for edge functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;