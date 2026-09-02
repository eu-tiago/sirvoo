
-- Create swap_requests table
CREATE TABLE public.swap_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL,
  requester_assignment_id uuid NOT NULL REFERENCES public.schedule_assignments(id) ON DELETE CASCADE,
  requested_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.swap_requests ENABLE ROW LEVEL SECURITY;

-- Users can view swap requests they are involved in
CREATE POLICY "Users can view their swap requests"
  ON public.swap_requests FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = requested_id);

-- Users can insert swap requests (as requester)
CREATE POLICY "Users can create swap requests"
  ON public.swap_requests FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

-- Requested user can update (accept/reject)
CREATE POLICY "Requested user can update swap requests"
  ON public.swap_requests FOR UPDATE
  USING (auth.uid() = requested_id);

-- Requester can delete their pending requests
CREATE POLICY "Requester can delete pending swap requests"
  ON public.swap_requests FOR DELETE
  USING (auth.uid() = requester_id AND status = 'pending');
