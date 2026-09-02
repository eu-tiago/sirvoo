
-- ============ SONGS ============
CREATE TABLE public.songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  title text NOT NULL,
  artist text,
  original_key text,
  bpm integer,
  time_signature text,
  category text,
  language text,
  duration_seconds integer,
  spotify_url text,
  youtube_url text,
  cifra_url text,
  multitracks_url text,
  playback_url text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.songs TO authenticated;
GRANT ALL ON public.songs TO service_role;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "songs_select_church_members" ON public.songs
  FOR SELECT TO authenticated
  USING (public.is_church_member(auth.uid(), church_id));

CREATE POLICY "songs_write_admin_or_leader" ON public.songs
  FOR ALL TO authenticated
  USING (
    public.is_church_member(auth.uid(), church_id)
    AND (public.is_church_admin(auth.uid(), church_id) OR public.has_role(auth.uid(), 'ministry_leader'))
  )
  WITH CHECK (
    public.is_church_member(auth.uid(), church_id)
    AND (public.is_church_admin(auth.uid(), church_id) OR public.has_role(auth.uid(), 'ministry_leader'))
  );

CREATE TRIGGER songs_updated_at BEFORE UPDATE ON public.songs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_songs_church ON public.songs(church_id);

-- ============ SONG FILES ============
CREATE TABLE public.song_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  church_id uuid NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  file_type text NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  size_bytes integer,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.song_files TO authenticated;
GRANT ALL ON public.song_files TO service_role;
ALTER TABLE public.song_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "song_files_select_church_members" ON public.song_files
  FOR SELECT TO authenticated
  USING (public.is_church_member(auth.uid(), church_id));

CREATE POLICY "song_files_write_admin_or_leader" ON public.song_files
  FOR ALL TO authenticated
  USING (
    public.is_church_member(auth.uid(), church_id)
    AND (public.is_church_admin(auth.uid(), church_id) OR public.has_role(auth.uid(), 'ministry_leader'))
  )
  WITH CHECK (
    public.is_church_member(auth.uid(), church_id)
    AND (public.is_church_admin(auth.uid(), church_id) OR public.has_role(auth.uid(), 'ministry_leader'))
  );

CREATE INDEX idx_song_files_song ON public.song_files(song_id);

-- ============ PLAYLISTS ============
CREATE TABLE public.playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playlists TO authenticated;
GRANT ALL ON public.playlists TO service_role;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "playlists_select_church_members" ON public.playlists
  FOR SELECT TO authenticated
  USING (public.is_church_member(auth.uid(), church_id));

CREATE POLICY "playlists_write_admin_or_leader" ON public.playlists
  FOR ALL TO authenticated
  USING (
    public.is_church_member(auth.uid(), church_id)
    AND (public.is_church_admin(auth.uid(), church_id) OR public.has_role(auth.uid(), 'ministry_leader'))
  )
  WITH CHECK (
    public.is_church_member(auth.uid(), church_id)
    AND (public.is_church_admin(auth.uid(), church_id) OR public.has_role(auth.uid(), 'ministry_leader'))
  );

CREATE TRIGGER playlists_updated_at BEFORE UPDATE ON public.playlists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_playlists_church ON public.playlists(church_id);

-- ============ PLAYLIST SONGS ============
CREATE TABLE public.playlist_songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  church_id uuid NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (playlist_id, song_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playlist_songs TO authenticated;
GRANT ALL ON public.playlist_songs TO service_role;
ALTER TABLE public.playlist_songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "playlist_songs_select_church_members" ON public.playlist_songs
  FOR SELECT TO authenticated
  USING (public.is_church_member(auth.uid(), church_id));

CREATE POLICY "playlist_songs_write_admin_or_leader" ON public.playlist_songs
  FOR ALL TO authenticated
  USING (
    public.is_church_member(auth.uid(), church_id)
    AND (public.is_church_admin(auth.uid(), church_id) OR public.has_role(auth.uid(), 'ministry_leader'))
  )
  WITH CHECK (
    public.is_church_member(auth.uid(), church_id)
    AND (public.is_church_admin(auth.uid(), church_id) OR public.has_role(auth.uid(), 'ministry_leader'))
  );

CREATE INDEX idx_playlist_songs_playlist ON public.playlist_songs(playlist_id);

-- ============ EVENT REPERTOIRE ============
CREATE TABLE public.event_repertoire (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  church_id uuid NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  performed_key text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, song_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_repertoire TO authenticated;
GRANT ALL ON public.event_repertoire TO service_role;
ALTER TABLE public.event_repertoire ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_repertoire_select_church_members" ON public.event_repertoire
  FOR SELECT TO authenticated
  USING (public.is_church_member(auth.uid(), church_id));

CREATE POLICY "event_repertoire_write_admin_or_leader" ON public.event_repertoire
  FOR ALL TO authenticated
  USING (
    public.is_church_member(auth.uid(), church_id)
    AND (public.is_church_admin(auth.uid(), church_id) OR public.has_role(auth.uid(), 'ministry_leader'))
  )
  WITH CHECK (
    public.is_church_member(auth.uid(), church_id)
    AND (public.is_church_admin(auth.uid(), church_id) OR public.has_role(auth.uid(), 'ministry_leader'))
  );

CREATE INDEX idx_event_repertoire_event ON public.event_repertoire(event_id);
CREATE INDEX idx_event_repertoire_church ON public.event_repertoire(church_id);
