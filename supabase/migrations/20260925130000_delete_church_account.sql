-- Called only by the admin-financial Edge Function after Master authorization.
CREATE FUNCTION public.delete_church_account(_church_id uuid, _confirmation_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE church_name text;
BEGIN
  SELECT name INTO church_name FROM public.churches WHERE id = _church_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Igreja não encontrada'; END IF;
  IF _confirmation_name IS DISTINCT FROM church_name THEN
    RAISE EXCEPTION 'Digite o nome da igreja exatamente como exibido';
  END IF;
  PERFORM 1 FROM public.church_subscriptions WHERE church_id = _church_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.church_subscriptions WHERE church_id = _church_id
    AND (stripe_customer_id IS NOT NULL OR stripe_subscription_id IS NOT NULL)) THEN
    RAISE EXCEPTION 'Esta conta está vinculada ao Stripe. Revise e encerre o vínculo financeiro antes de excluí-la.';
  END IF;

  -- Quotas have no foreign key in the legacy schema. Delete in the same transaction.
  DELETE FROM public.schedule_role_quotas WHERE schedule_id IN (
    SELECT s.id FROM public.schedules s JOIN public.ministries m ON m.id = s.ministry_id
    WHERE m.church_id = _church_id
  );
  DELETE FROM public.recurring_schedules WHERE church_id = _church_id;
  DELETE FROM public.recurring_assignments WHERE church_id = _church_id;
  DELETE FROM public.invitations WHERE church_id = _church_id;
  -- Remove assignments before ministry roles to respect their non-cascading FK.
  DELETE FROM public.schedule_assignments WHERE schedule_id IN (
    SELECT s.id FROM public.schedules s JOIN public.ministries m ON m.id = s.ministry_id
    WHERE m.church_id = _church_id
  );
  DELETE FROM public.churches WHERE id = _church_id;
END $$;
REVOKE ALL ON FUNCTION public.delete_church_account(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.delete_church_account(uuid,text) TO service_role;
