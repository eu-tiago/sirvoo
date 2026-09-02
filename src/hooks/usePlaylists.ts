import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useChurchId } from "./useChurchId";
import { useToast } from "./use-toast";

export type Playlist = {
  id: string;
  church_id: string;
  name: string;
  description: string | null;
  created_at: string;
};

export type PlaylistSong = {
  id: string;
  playlist_id: string;
  song_id: string;
  position: number;
  song?: { id: string; title: string; artist: string | null; original_key: string | null };
};

export function usePlaylists() {
  const { churchId } = useChurchId();
  const qc = useQueryClient();
  const { toast } = useToast();

  const list = useQuery({
    queryKey: ["playlists", churchId],
    enabled: !!churchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlists")
        .select("*")
        .eq("church_id", churchId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Playlist[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: { name: string; description?: string }) => {
      if (!churchId) throw new Error("Sem igreja");
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("playlists")
        .insert({ name: input.name, description: input.description ?? null, church_id: churchId, created_by: user?.id ?? null })
        .select()
        .single();
      if (error) throw error;
      return data as Playlist;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["playlists", churchId] });
      toast({ title: "Playlist criada" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("playlists").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playlists", churchId] }),
  });

  return { ...list, create, remove };
}

export function usePlaylistSongs(playlistId: string | null) {
  const { churchId } = useChurchId();
  const qc = useQueryClient();
  const { toast } = useToast();

  const q = useQuery({
    queryKey: ["playlist_songs", playlistId],
    enabled: !!playlistId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlist_songs")
        .select("id, playlist_id, song_id, position, song:songs(id,title,artist,original_key)")
        .eq("playlist_id", playlistId!)
        .order("position");
      if (error) throw error;
      return (data ?? []) as unknown as PlaylistSong[];
    },
  });

  const add = useMutation({
    mutationFn: async (song_id: string) => {
      if (!playlistId || !churchId) throw new Error("Playlist inválida");
      const pos = q.data?.length ?? 0;
      const { error } = await supabase
        .from("playlist_songs")
        .insert({ playlist_id: playlistId, song_id, church_id: churchId, position: pos });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playlist_songs", playlistId] }),
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("playlist_songs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playlist_songs", playlistId] }),
  });

  return { ...q, add, remove };
}
