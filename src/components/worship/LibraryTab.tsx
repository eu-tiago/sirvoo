import { useMemo, useState } from "react";
import { useSongs } from "@/hooks/useSongs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Music } from "lucide-react";
import { SongLinks } from "./SongLinksBlock";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export function LibraryTab() {
  const { data: songs = [], isLoading } = useSongs();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [lang, setLang] = useState("");

  const categories = useMemo(
    () => Array.from(new Set(songs.map((s) => s.category).filter(Boolean))) as string[],
    [songs]
  );
  const languages = useMemo(
    () => Array.from(new Set(songs.map((s) => s.language).filter(Boolean))) as string[],
    [songs]
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return songs.filter((x) => {
      if (category && x.category !== category) return false;
      if (lang && x.language !== lang) return false;
      if (!s) return true;
      return [x.title, x.artist, x.original_key, x.category].filter(Boolean).some((v) => v!.toLowerCase().includes(s));
    });
  }, [songs, q, category, lang]);

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="relative sm:col-span-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar..." className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Todas categorias</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={lang}
          onChange={(e) => setLang(e.target.value)}
        >
          <option value="">Todos idiomas</option>
          {languages.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <Music className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma música encontrada.</p>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Artista</TableHead>
                    <TableHead>Tom</TableHead>
                    <TableHead>BPM</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Links</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.title}</TableCell>
                      <TableCell className="text-muted-foreground">{s.artist ?? "—"}</TableCell>
                      <TableCell>{s.original_key ?? "—"}</TableCell>
                      <TableCell>{s.bpm ?? "—"}</TableCell>
                      <TableCell>{s.category ? <Badge variant="outline">{s.category}</Badge> : "—"}</TableCell>
                      <TableCell><SongLinks song={s} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden">
            {filtered.map((s) => (
              <Card key={s.id} className="p-3">
                <p className="font-semibold">{s.title}</p>
                {s.artist && <p className="text-xs text-muted-foreground">{s.artist}</p>}
                <div className="flex flex-wrap gap-1 mt-2">
                  {s.original_key && <Badge variant="secondary" className="text-xs">Tom {s.original_key}</Badge>}
                  {s.bpm && <Badge variant="secondary" className="text-xs">{s.bpm} BPM</Badge>}
                  {s.category && <Badge variant="outline" className="text-xs">{s.category}</Badge>}
                </div>
                <SongLinks song={s} className="mt-2" />
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
