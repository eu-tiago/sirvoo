import { useMemo, useState } from "react";
import { useSongs, type Song } from "@/hooks/useSongs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, Music } from "lucide-react";
import { SongDialog } from "./SongDialog";
import { SongLinks } from "./SongLinksBlock";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function RepertoireTab({ canEdit }: { canEdit: boolean }) {
  const { data: songs = [], isLoading, upsert, remove } = useSongs();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Song | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Song | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return songs;
    return songs.filter((x) =>
      [x.title, x.artist, x.category, x.original_key].filter(Boolean).some((v) => v!.toLowerCase().includes(s))
    );
  }, [songs, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nome, artista, tom..." className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {canEdit && (
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Nova música
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <Music className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma música cadastrada.</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((song) => (
            <Card key={song.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{song.title}</p>
                  {song.artist && <p className="text-xs text-muted-foreground truncate">{song.artist}</p>}
                </div>
                {canEdit && (
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(song); setOpen(true); }}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setToDelete(song)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {song.original_key && <Badge variant="secondary" className="text-xs">Tom {song.original_key}</Badge>}
                {song.bpm && <Badge variant="secondary" className="text-xs">{song.bpm} BPM</Badge>}
                {song.time_signature && <Badge variant="secondary" className="text-xs">{song.time_signature}</Badge>}
                {song.category && <Badge variant="outline" className="text-xs">{song.category}</Badge>}
              </div>
              <SongLinks song={song} />
            </Card>
          ))}
        </div>
      )}

      <SongDialog
        open={open}
        onOpenChange={setOpen}
        song={editing}
        onSave={(input) => upsert.mutateAsync(input)}
        saving={upsert.isPending}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir música?</AlertDialogTitle>
            <AlertDialogDescription>
              "{toDelete?.title}" será removida do repertório, playlists e repertórios de eventos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (toDelete) await remove.mutateAsync(toDelete.id);
                setToDelete(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
