
-- Create app_role enum for user permissions
CREATE TYPE public.app_role AS ENUM ('admin', 'ministry_leader', 'volunteer');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'volunteer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Create churches table
CREATE TABLE public.churches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  timezone TEXT DEFAULT 'America/Sao_Paulo',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.churches ENABLE ROW LEVEL SECURITY;

-- Create church_members table (links users to churches)
CREATE TABLE public.church_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'volunteer',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (church_id, user_id)
);

ALTER TABLE public.church_members ENABLE ROW LEVEL SECURITY;

-- Create ministries table
CREATE TABLE public.ministries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'music',
  color TEXT DEFAULT '#5B7BFF',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ministries ENABLE ROW LEVEL SECURITY;

-- Create ministry_roles table (roles within a ministry like "Vocal Lead", "Guitarist")
CREATE TABLE public.ministry_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ministry_roles ENABLE ROW LEVEL SECURITY;

-- Create ministry_members table (links users to ministries)
CREATE TABLE public.ministry_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_leader BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ministry_id, user_id)
);

ALTER TABLE public.ministry_members ENABLE ROW LEVEL SECURITY;

-- Create member_roles table (which roles a member can perform)
CREATE TABLE public.member_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.ministry_members(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.ministry_roles(id) ON DELETE CASCADE,
  UNIQUE (member_id, role_id)
);

ALTER TABLE public.member_roles ENABLE ROW LEVEL SECURITY;

-- Create events table (services, rehearsals, special events)
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT DEFAULT 'service', -- service, rehearsal, special
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Create schedules table (links events to ministries)
CREATE TABLE public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'draft', -- draft, published, completed
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

-- Create schedule_assignments table (assigns volunteers to schedules)
CREATE TABLE public.schedule_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.ministry_roles(id),
  status TEXT DEFAULT 'pending', -- pending, confirmed, declined, substituted
  confirmed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.schedule_assignments ENABLE ROW LEVEL SECURITY;

-- Create volunteer_availability table
CREATE TABLE public.volunteer_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_available BOOLEAN DEFAULT false,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.volunteer_availability ENABLE ROW LEVEL SECURITY;

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info', -- info, schedule, reminder, substitution
  is_read BOOLEAN DEFAULT false,
  related_schedule_id UUID REFERENCES public.schedules(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for churches
CREATE POLICY "Church members can view their churches" ON public.churches
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.church_members WHERE church_id = churches.id AND user_id = auth.uid())
  );

CREATE POLICY "Admins can insert churches" ON public.churches
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Church admins can update their churches" ON public.churches
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.church_members WHERE church_id = churches.id AND user_id = auth.uid() AND role = 'admin')
  );

-- RLS Policies for church_members
CREATE POLICY "Users can view church members of their churches" ON public.church_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.church_members cm WHERE cm.church_id = church_members.church_id AND cm.user_id = auth.uid())
  );

CREATE POLICY "Church admins can manage members" ON public.church_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.church_members cm WHERE cm.church_id = church_members.church_id AND cm.user_id = auth.uid() AND cm.role = 'admin')
  );

CREATE POLICY "Users can insert themselves into churches" ON public.church_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for ministries
CREATE POLICY "Church members can view ministries" ON public.ministries
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.church_members WHERE church_id = ministries.church_id AND user_id = auth.uid())
  );

CREATE POLICY "Church admins can manage ministries" ON public.ministries
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.church_members WHERE church_id = ministries.church_id AND user_id = auth.uid() AND role = 'admin')
  );

-- RLS Policies for ministry_roles
CREATE POLICY "Church members can view ministry roles" ON public.ministry_roles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ministries m
      JOIN public.church_members cm ON cm.church_id = m.church_id
      WHERE m.id = ministry_roles.ministry_id AND cm.user_id = auth.uid()
    )
  );

-- RLS Policies for ministry_members
CREATE POLICY "Ministry members can view their ministry members" ON public.ministry_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.ministry_members mm WHERE mm.ministry_id = ministry_members.ministry_id AND mm.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      JOIN public.church_members cm ON cm.church_id = m.church_id
      WHERE m.id = ministry_members.ministry_id AND cm.user_id = auth.uid() AND cm.role = 'admin'
    )
  );

-- RLS Policies for member_roles
CREATE POLICY "Users can view member roles" ON public.member_roles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ministry_members mm
      WHERE mm.id = member_roles.member_id AND mm.user_id = auth.uid()
    )
  );

-- RLS Policies for events
CREATE POLICY "Church members can view events" ON public.events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.church_members WHERE church_id = events.church_id AND user_id = auth.uid())
  );

CREATE POLICY "Church admins can manage events" ON public.events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.church_members WHERE church_id = events.church_id AND user_id = auth.uid() AND role = 'admin')
  );

-- RLS Policies for schedules
CREATE POLICY "Users can view schedules of their ministries" ON public.schedules
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.ministry_members WHERE ministry_id = schedules.ministry_id AND user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      JOIN public.church_members cm ON cm.church_id = m.church_id
      WHERE m.id = schedules.ministry_id AND cm.user_id = auth.uid() AND cm.role = 'admin'
    )
  );

-- RLS Policies for schedule_assignments
CREATE POLICY "Users can view their assignments" ON public.schedule_assignments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their assignments" ON public.schedule_assignments
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for volunteer_availability
CREATE POLICY "Users can manage their availability" ON public.volunteer_availability
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for notifications
CREATE POLICY "Users can view their notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Trigger function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  
  -- Give new user default volunteer role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'volunteer');
  
  RETURN NEW;
END;
$$;

-- Trigger to create profile on auth signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_churches_updated_at BEFORE UPDATE ON public.churches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ministries_updated_at BEFORE UPDATE ON public.ministries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_schedule_assignments_updated_at BEFORE UPDATE ON public.schedule_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
