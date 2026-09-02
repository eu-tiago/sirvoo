-- Fix infinite recursion in RLS policies by creating SECURITY DEFINER helper functions

-- Function to check if user is a member of a church
CREATE OR REPLACE FUNCTION public.is_church_member(_user_id uuid, _church_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.church_members
    WHERE user_id = _user_id AND church_id = _church_id
  )
$$;

-- Function to check if user is admin of a church
CREATE OR REPLACE FUNCTION public.is_church_admin(_user_id uuid, _church_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.church_members
    WHERE user_id = _user_id AND church_id = _church_id AND role = 'admin'
  )
$$;

-- Function to get user's church ids
CREATE OR REPLACE FUNCTION public.get_user_church_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT church_id FROM public.church_members WHERE user_id = _user_id
$$;

-- Function to check if two users share a church (for admin to view other users)
CREATE OR REPLACE FUNCTION public.users_share_church(_admin_user_id uuid, _target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.church_members cm1
    JOIN public.church_members cm2 ON cm1.church_id = cm2.church_id
    WHERE cm1.user_id = _admin_user_id 
      AND cm1.role = 'admin'
      AND cm2.user_id = _target_user_id
  )
$$;

-- Drop existing problematic policies and recreate with helper functions

-- church_members policies
DROP POLICY IF EXISTS "Users can view church members of their churches" ON public.church_members;
DROP POLICY IF EXISTS "Church admins can manage members" ON public.church_members;
DROP POLICY IF EXISTS "Users can insert themselves into churches" ON public.church_members;

CREATE POLICY "Users can view their own membership"
ON public.church_members FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can view members of their churches"
ON public.church_members FOR SELECT
USING (church_id IN (SELECT public.get_user_church_ids(auth.uid())));

CREATE POLICY "Church admins can manage members"
ON public.church_members FOR ALL
USING (public.is_church_admin(auth.uid(), church_id));

CREATE POLICY "Users can insert themselves into churches"
ON public.church_members FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- user_roles policies
DROP POLICY IF EXISTS "Admins can view user roles in their church" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update user roles in their church" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view user roles in their church"
ON public.user_roles FOR SELECT
USING (public.users_share_church(auth.uid(), user_id));

CREATE POLICY "Admins can update user roles in their church"
ON public.user_roles FOR UPDATE
USING (public.users_share_church(auth.uid(), user_id));

-- profiles policies
DROP POLICY IF EXISTS "Admins can view profiles in their church" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Admins can view profiles in their church"
ON public.profiles FOR SELECT
USING (public.users_share_church(auth.uid(), id));

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);