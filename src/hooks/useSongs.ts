import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useChurchId } from "./useChurchId";
import { useToast } from "./use-toast";

export type Song = {
  id: string;
  church_id: string;
  title: string;
  artist: string | null;
  original_key: string | null;
  bpm: number | null;
  time_signature: string | null;
  category: string | null;
  language: string | null;
  duration_seconds: number | null;
  spotify_url: string | null;
  youtube_url: string | null;
  cifra_url: string | null;
  multitracks_url: string | null;
  playback_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SongInput = Partial<Omit<Song, "id" | "church_id" | "created_at" | "updated_at">> & {
  title: string;
};

export function useSongs() {
  const { churchId } = useChurchId();
  const qc = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ["songs", churchId],
    enabled: !!churchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("songs")
        .select("*")
        .eq("church_id", churchId!)
        .order("title");
      if (error) throw error;
      return (data ?? []) as Song[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: SongInput & { id?: string }) => {
      if (!churchId) throw new Error("Sem igreja");
      const { id, ...rest } = input;
      if (id) {
        const { error } = await supabase.from("songs").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
          .from("songs")
          .insert({ ...rest, church_id: churchId, created_by: user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["songs", churchId] });
      toast({ title: "Música salva" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("songs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["songs", churchId] });
      toast({ title: "Música removida" });
    },
  });

  return { ...query, upsert, remove };
}
