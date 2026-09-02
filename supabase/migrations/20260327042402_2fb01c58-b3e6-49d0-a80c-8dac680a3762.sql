
-- Allow ministry members to view swap requests in their ministry's schedules
CREATE POLICY "Ministry members can view ministry swap requests"
ON public.swap_requests FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM schedules s
    JOIN ministry_members mm ON mm.ministry_id = s.ministry_id
    WHERE s.id = swap_requests.schedule_id
      AND mm.user_id = auth.uid()
  )
);
