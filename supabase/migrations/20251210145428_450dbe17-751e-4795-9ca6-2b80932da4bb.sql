-- Create subscription plans enum
CREATE TYPE public.subscription_plan AS ENUM ('free', 'basic', 'standard');

-- Create church_subscriptions table to track subscriptions
CREATE TABLE public.church_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid REFERENCES public.churches(id) ON DELETE CASCADE NOT NULL UNIQUE,
  plan subscription_plan NOT NULL DEFAULT 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  max_users integer NOT NULL DEFAULT 3,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  status text DEFAULT 'active',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.church_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Church admins can view their subscription"
ON public.church_subscriptions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.church_members
    WHERE church_members.church_id = church_subscriptions.church_id
    AND church_members.user_id = auth.uid()
    AND church_members.role = 'admin'
  )
);

CREATE POLICY "Church admins can update their subscription"
ON public.church_subscriptions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.church_members
    WHERE church_members.church_id = church_subscriptions.church_id
    AND church_members.user_id = auth.uid()
    AND church_members.role = 'admin'
  )
);

-- Function to get current user count for a church
CREATE OR REPLACE FUNCTION public.get_church_user_count(_church_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.church_members
  WHERE church_id = _church_id
$$;

-- Function to check if church can add more users
CREATE OR REPLACE FUNCTION public.can_add_church_user(_church_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT get_church_user_count(_church_id) < max_users
     FROM public.church_subscriptions
     WHERE church_id = _church_id),
    get_church_user_count(_church_id) < 3  -- Default to free plan limit if no subscription
  )
$$;

-- Trigger to auto-create subscription when church is created
CREATE OR REPLACE FUNCTION public.handle_new_church_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.church_subscriptions (church_id, plan, max_users)
  VALUES (NEW.id, 'free', 3);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_church_created_subscription
  AFTER INSERT ON public.churches
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_church_subscription();

-- Update updated_at trigger
CREATE TRIGGER update_church_subscriptions_updated_at
  BEFORE UPDATE ON public.church_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add policy to prevent adding users beyond limit
CREATE POLICY "Prevent adding users beyond subscription limit"
ON public.church_members
FOR INSERT
WITH CHECK (
  can_add_church_user(church_id)
);