import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { Song, SongInput } from "@/hooks/useSongs";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  song: Song | null;
  onSave: (input: SongInput & { id?: string }) => Promise<any>;
  saving?: boolean;
}

const EMPTY: SongInput = {
  title: "",
  artist: "",
  original_key: "",
  bpm: null,
  time_signature: "",
  category: "",
  language: "",
  duration_seconds: null,
  spotify_url: "",
  youtube_url: "",
  cifra_url: "",
  multitracks_url: "",
  playback_url: "",
  notes: "",
};

export function SongDialog({ open, onOpenChange, song, onSave, saving }: Props) {
  const [form, setForm] = useState<SongInput>(EMPTY);

  useEffect(() => {
    if (song) setForm({ ...(song as any) });
    else setForm(EMPTY);
  }, [song, open]);

  const set = (k: keyof SongInput) => (v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.title.trim()) return;
    const clean: any = { ...form };
    for (const k of Object.keys(clean)) if (clean[k] === "") clean[k] = null;
    clean.title = form.title.trim();
    if (typeof clean.bpm === "string") clean.bpm = clean.bpm ? Number(clean.bpm) : null;
    if (typeof clean.duration_seconds === "string")
      clean.duration_seconds = clean.duration_seconds ? Number(clean.duration_seconds) : null;
    await onSave({ ...clean, id: song?.id });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{song ? "Editar música" : "Nova música"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label>Nome *</Label>
            <Input value={form.title ?? ""} onChange={(e) => set("title")(e.target.value)} />
          </div>
          <div>
            <Label>Artista</Label>
            <Input value={form.artist ?? ""} onChange={(e) => set("artist")(e.target.value)} />
          </div>
          <div>
            <Label>Categoria</Label>
            <Input placeholder="Adoração, Contemporânea..." value={form.category ?? ""} onChange={(e) => set("category")(e.target.value)} />
          </div>
          <div>
            <Label>Tom original</Label>
            <Input placeholder="G, D, Bm..." value={form.original_key ?? ""} onChange={(e) => set("original_key")(e.target.value)} />
          </div>
          <div>
            <Label>BPM</Label>
            <Input type="number" value={form.bpm ?? ""} onChange={(e) => set("bpm")(e.target.value)} />
          </div>
          <div>
            <Label>Tempo</Label>
            <Input placeholder="4/4, 3/4, 6/8" value={form.time_signature ?? ""} onChange={(e) => set("time_signature")(e.target.value)} />
          </div>
          <div>
            <Label>Idioma</Label>
            <Input placeholder="PT, EN..." value={form.language ?? ""} onChange={(e) => set("language")(e.target.value)} />
          </div>
          <div>
            <Label>Duração (segundos)</Label>
            <Input type="number" value={form.duration_seconds ?? ""} onChange={(e) => set("duration_seconds")(e.target.value)} />
          </div>
          <div className="sm:col-span-2 pt-2">
            <p className="text-sm font-semibold text-muted-foreground">Links</p>
          </div>
          <div><Label>Spotify</Label><Input value={form.spotify_url ?? ""} onChange={(e) => set("spotify_url")(e.target.value)} /></div>
          <div><Label>YouTube</Label><Input value={form.youtube_url ?? ""} onChange={(e) => set("youtube_url")(e.target.value)} /></div>
          <div><Label>Cifra Club</Label><Input value={form.cifra_url ?? ""} onChange={(e) => set("cifra_url")(e.target.value)} /></div>
          <div><Label>Multitracks</Label><Input value={form.multitracks_url ?? ""} onChange={(e) => set("multitracks_url")(e.target.value)} /></div>
          <div className="sm:col-span-2"><Label>Playback</Label><Input value={form.playback_url ?? ""} onChange={(e) => set("playback_url")(e.target.value)} /></div>
          <div className="sm:col-span-2">
            <Label>Observações</Label>
            <Textarea rows={3} value={form.notes ?? ""} onChange={(e) => set("notes")(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!form.title?.trim() || saving}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
