import { useState } from "react";
import { usePlaylists, usePlaylistSongs } from "@/hooks/usePlaylists";
import { useSongs } from "@/hooks/useSongs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, ListMusic, X, ChevronRight, Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import type { Playlist } from "@/hooks/usePlaylists";
import { Badge } from "@/components/ui/badge";

export function PlaylistsTab({ canEdit }: { canEdit: boolean }) {
  const { data: playlists = [], isLoading, create, remove } = usePlaylists();
  const [selected, setSelected] = useState<Playlist | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  return (
    <div className="grid gap-4 md:grid-cols-[280px_1fr]">
      {/* Sidebar */}
      <div className="space-y-2">
        {canEdit && (
          <Button className="w-full" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nova playlist
          </Button>
        )}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : playlists.length === 0 ? (
          <Card className="p-6 text-center">
            <ListMusic className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">Sem playlists</p>
          </Card>
        ) : (
          <div className="space-y-1">
            {playlists.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className={`w-full text-left p-3 rounded-lg border hover:bg-muted transition ${selected?.id === p.id ? "bg-muted border-primary" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{p.name}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
                {p.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.description}</p>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail */}
      <div>
        {selected ? (
          <PlaylistDetail
            playlist={selected}
            canEdit={canEdit}
            onDelete={async () => {
              await remove.mutateAsync(selected.id);
              setSelected(null);
            }}
          />
        ) : (
          <Card className="p-8 text-center">
            <p className="text-sm text-muted-foreground">Selecione uma playlist para ver e editar as músicas.</p>
          </Card>
        )}
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova playlist</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Culto Domingo Manhã" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button
              disabled={!name.trim() || create.isPending}
              onClick={async () => {
                await create.mutateAsync({ name: name.trim(), description: description.trim() || undefined });
                setName(""); setDescription(""); setCreating(false);
              }}
            >
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlaylistDetail({ playlist, canEdit, onDelete }: { playlist: Playlist; canEdit: boolean; onDelete: () => void }) {
  const { data: items = [], add, remove } = usePlaylistSongs(playlist.id);
  const { data: songs = [] } = useSongs();
  const [q, setQ] = useState("");

  const existing = new Set(items.map((i) => i.song_id));
  const options = songs.filter((s) => !existing.has(s.id) && s.title.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-lg">{playlist.name}</h3>
          {playlist.description && <p className="text-sm text-muted-foreground">{playlist.description}</p>}
        </div>
        {canEdit && (
          <Button variant="ghost" size="icon" className="text-destructive" onClick={onDelete}>
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-xs uppercase font-semibold text-muted-foreground">Músicas ({items.length})</p>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma música ainda.</p>
        ) : (
          items.map((it, idx) => (
            <div key={it.id} className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
              <span className="text-xs w-5 text-muted-foreground">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{it.song?.title}</p>
                <p className="text-xs text-muted-foreground truncate">{it.song?.artist} {it.song?.original_key && <Badge variant="secondary" className="ml-1 text-[10px]">Tom {it.song.original_key}</Badge>}</p>
              </div>
              {canEdit && (
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove.mutate(it.id)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          ))
        )}
      </div>

      {canEdit && (
        <div>
          <p className="text-xs uppercase font-semibold text-muted-foreground mb-2">Adicionar música</p>
          <Input placeholder="Buscar no repertório..." value={q} onChange={(e) => setQ(e.target.value)} />
          {q && (
            <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
              {options.slice(0, 10).map((s) => (
                <button
                  key={s.id}
                  className="w-full text-left p-2 rounded-md hover:bg-muted text-sm flex items-center justify-between"
                  onClick={() => add.mutate(s.id)}
                >
                  <span>{s.title} {s.artist && <span className="text-muted-foreground">— {s.artist}</span>}</span>
                  <Plus className="w-4 h-4" />
                </button>
              ))}
              {options.length === 0 && <p className="text-xs text-muted-foreground px-2">Nada encontrado.</p>}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
