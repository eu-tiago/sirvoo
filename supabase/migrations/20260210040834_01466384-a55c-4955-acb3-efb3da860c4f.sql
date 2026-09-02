
-- Create schedule_songs table for music links MVP
CREATE TABLE public.schedule_songs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  youtube_url TEXT,
  chord_url TEXT,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.schedule_songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Church members can view schedule songs"
ON public.schedule_songs FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM schedules s
    JOIN ministries m ON s.ministry_id = m.id
    JOIN church_members cm ON cm.church_id = m.church_id
    WHERE s.id = schedule_songs.schedule_id AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Admins and leaders can insert schedule songs"
ON public.schedule_songs FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM schedules s
    JOIN ministries m ON s.ministry_id = m.id
    JOIN church_members cm ON cm.church_id = m.church_id
    WHERE s.id = schedule_songs.schedule_id 
    AND cm.user_id = auth.uid()
    AND cm.role IN ('admin', 'ministry_leader')
  )
);

CREATE POLICY "Admins and leaders can update schedule songs"
ON public.schedule_songs FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM schedules s
    JOIN ministries m ON s.ministry_id = m.id
    JOIN church_members cm ON cm.church_id = m.church_id
    WHERE s.id = schedule_songs.schedule_id 
    AND cm.user_id = auth.uid()
    AND cm.role IN ('admin', 'ministry_leader')
  )
);

CREATE POLICY "Admins and leaders can delete schedule songs"
ON public.schedule_songs FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM schedules s
    JOIN ministries m ON s.ministry_id = m.id
    JOIN church_members cm ON cm.church_id = m.church_id
    WHERE s.id = schedule_songs.schedule_id 
    AND cm.user_id = auth.uid()
    AND cm.role IN ('admin', 'ministry_leader')
  )
);
