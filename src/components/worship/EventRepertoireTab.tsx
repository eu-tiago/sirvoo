import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useChurchId } from "@/hooks/useChurchId";
import { useEventRepertoire } from "@/hooks/useEventRepertoire";
import { useSongs } from "@/hooks/useSongs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar, GripVertical, Plus, X, ListMusic } from "lucide-react";
import { SongLinks } from "./SongLinksBlock";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, verticalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type EventOpt = { id: string; title: string; event_date: string; start_time: string };

export function EventRepertoireTab({ canEdit }: { canEdit: boolean }) {
  const { churchId } = useChurchId();
  const [events, setEvents] = useState<EventOpt[]>([]);
  const [eventId, setEventId] = useState<string | null>(null);

  useEffect(() => {
    if (!churchId) return;
    (async () => {
      const { data } = await supabase
        .from("events")
        .select("id,title,event_date,start_time")
        .eq("church_id", churchId)
        .order("event_date", { ascending: false })
        .limit(50);
      setEvents((data ?? []) as EventOpt[]);
      if (data && data.length && !eventId) setEventId(data[0].id);
    })();
  }, [churchId]);

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Calendar className="w-4 h-4" /> Evento
        </div>
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm flex-1"
          value={eventId ?? ""}
          onChange={(e) => setEventId(e.target.value || null)}
        >
          <option value="">Selecione um evento</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {new Date(e.event_date + "T00:00:00").toLocaleDateString("pt-BR")} — {e.title}
            </option>
          ))}
        </select>
      </Card>

      {eventId ? (
        <RepertoireEditor eventId={eventId} canEdit={canEdit} />
      ) : (
        <Card className="p-8 text-center">
          <ListMusic className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Selecione um evento para montar o repertório.</p>
        </Card>
      )}
    </div>
  );
}

function RepertoireEditor({ eventId, canEdit }: { eventId: string; canEdit: boolean }) {
  const { data: items = [], add, remove, reorder, updateKey } = useEventRepertoire(eventId);
  const { data: songs = [] } = useSongs();
  const [q, setQ] = useState("");

  const [order, setOrder] = useState(items);
  useEffect(() => setOrder(items), [items]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = order.findIndex((i) => i.id === active.id);
    const newIndex = order.findIndex((i) => i.id === over.id);
    const next = arrayMove(order, oldIndex, newIndex);
    setOrder(next);
    reorder.mutate(next.map((it, idx) => ({ id: it.id, position: idx })));
  };

  const existing = new Set(order.map((i) => i.song_id));
  const options = useMemo(
    () => songs.filter((s) => !existing.has(s.id) && s.title.toLowerCase().includes(q.trim().toLowerCase())),
    [songs, existing, q]
  );

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_320px]">
      <Card className="p-4 space-y-3">
        <p className="text-xs uppercase font-semibold text-muted-foreground">
          Repertório ({order.length})
        </p>
        {order.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma música. Adicione ao lado.</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={order.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {order.map((it, idx) => (
                  <SortableRow
                    key={it.id}
                    id={it.id}
                    index={idx}
                    item={it}
                    canEdit={canEdit}
                    onRemove={() => remove.mutate(it.id)}
                    onKeyChange={(v) => updateKey.mutate({ id: it.id, performed_key: v || null })}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </Card>

      {canEdit && (
        <Card className="p-4 space-y-3 h-fit">
          <p className="text-xs uppercase font-semibold text-muted-foreground">Adicionar música</p>
          <Input placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="max-h-96 overflow-y-auto space-y-1">
            {options.slice(0, 20).map((s) => (
              <button
                key={s.id}
                onClick={() => add.mutate(s.id)}
                className="w-full text-left p-2 rounded-md hover:bg-muted text-sm flex items-center justify-between gap-2"
              >
                <span className="truncate">
                  {s.title}
                  {s.artist && <span className="text-muted-foreground"> — {s.artist}</span>}
                </span>
                <Plus className="w-4 h-4 shrink-0" />
              </button>
            ))}
            {options.length === 0 && <p className="text-xs text-muted-foreground px-2">Nada encontrado.</p>}
          </div>
        </Card>
      )}
    </div>
  );
}

function SortableRow({
  id, index, item, canEdit, onRemove, onKeyChange,
}: {
  id: string; index: number; item: any; canEdit: boolean; onRemove: () => void; onKeyChange: (v: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-2 rounded-md border bg-card">
      {canEdit && (
        <button className="cursor-grab touch-none text-muted-foreground" {...attributes} {...listeners}>
          <GripVertical className="w-4 h-4" />
        </button>
      )}
      <span className="text-xs w-5 text-muted-foreground">{index + 1}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.song?.title}</p>
        <p className="text-xs text-muted-foreground truncate">
          {item.song?.artist}
          {item.song?.original_key && <> · Tom original {item.song.original_key}</>}
        </p>
        <SongLinks song={item.song ?? { title: "" }} className="mt-1" />
      </div>
      {canEdit ? (
        <Input
          className="w-20 h-8 text-xs"
          placeholder="Tom"
          defaultValue={item.performed_key ?? ""}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== (item.performed_key ?? "")) onKeyChange(v);
          }}
        />
      ) : (
        item.performed_key && <Badge variant="secondary" className="text-xs">Tom {item.performed_key}</Badge>
      )}
      {canEdit && (
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onRemove}>
          <X className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}
