import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useChurchId } from "./useChurchId";
import { useToast } from "./use-toast";

export type RepertoireItem = {
  id: string;
  event_id: string;
  song_id: string;
  position: number;
  performed_key: string | null;
  notes: string | null;
  song?: {
    id: string;
    title: string;
    artist: string | null;
    original_key: string | null;
    spotify_url: string | null;
    youtube_url: string | null;
    cifra_url: string | null;
    playback_url: string | null;
    multitracks_url: string | null;
  };
};

export function useEventRepertoire(eventId: string | null) {
  const { churchId } = useChurchId();
  const qc = useQueryClient();
  const { toast } = useToast();

  const q = useQuery({
    queryKey: ["event_repertoire", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_repertoire")
        .select("id, event_id, song_id, position, performed_key, notes, song:songs(id,title,artist,original_key,spotify_url,youtube_url,cifra_url,playback_url,multitracks_url)")
        .eq("event_id", eventId!)
        .order("position");
      if (error) throw error;
      return (data ?? []) as unknown as RepertoireItem[];
    },
  });

  const add = useMutation({
    mutationFn: async (song_id: string) => {
      if (!eventId || !churchId) throw new Error("Evento inválido");
      const pos = q.data?.length ?? 0;
      const { error } = await supabase
        .from("event_repertoire")
        .insert({ event_id: eventId, song_id, church_id: churchId, position: pos });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event_repertoire", eventId] }),
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_repertoire").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event_repertoire", eventId] }),
  });

  const reorder = useMutation({
    mutationFn: async (items: { id: string; position: number }[]) => {
      // Update positions in parallel
      const results = await Promise.all(
        items.map((it) => supabase.from("event_repertoire").update({ position: it.position }).eq("id", it.id))
      );
      const err = results.find((r) => r.error);
      if (err?.error) throw err.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event_repertoire", eventId] }),
  });

  const updateKey = useMutation({
    mutationFn: async ({ id, performed_key }: { id: string; performed_key: string | null }) => {
      const { error } = await supabase.from("event_repertoire").update({ performed_key }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event_repertoire", eventId] }),
  });

  return { ...q, add, remove, reorder, updateKey };
}
