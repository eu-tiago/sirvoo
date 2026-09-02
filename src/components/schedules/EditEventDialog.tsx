import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useChurchId } from "@/hooks/useChurchId";

interface EditEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string | null;
  initialTitle?: string;
  initialDate?: string; // yyyy-mm-dd
  initialTime?: string; // HH:mm
  initialLocation?: string;
  onSaved?: () => void;
}

interface MinistryOption {
  id: string;
  name: string;
}

export function EditEventDialog({
  open,
  onOpenChange,
  eventId,
  initialTitle = "",
  initialDate = "",
  initialTime = "",
  initialLocation = "",
  onSaved,
}: EditEventDialogProps) {
  const { toast } = useToast();
  const { churchId } = useChurchId();
  const [title, setTitle] = useState(initialTitle);
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [location, setLocation] = useState(initialLocation);
  const [saving, setSaving] = useState(false);

  const [ministries, setMinistries] = useState<MinistryOption[]>([]);
  const [selectedMinistries, setSelectedMinistries] = useState<Set<string>>(new Set());
  const [initialMinistries, setInitialMinistries] = useState<Set<string>>(new Set());
  // schedule_id por ministry_id (para poder deletar as escalas removidas)
  const [scheduleByMinistry, setScheduleByMinistry] = useState<Record<string, string>>({});
  const [loadingMinistries, setLoadingMinistries] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
      setDate(initialDate);
      setTime(initialTime);
      setLocation(initialLocation);
    }
  }, [open, initialTitle, initialDate, initialTime, initialLocation]);

  useEffect(() => {
    if (!open || !eventId || !churchId) return;
    const load = async () => {
      setLoadingMinistries(true);
      try {
        const [minRes, schRes] = await Promise.all([
          supabase
            .from("ministries")
            .select("id, name")
            .eq("church_id", churchId)
            .order("name"),
          supabase
            .from("schedules")
            .select("id, ministry_id")
            .eq("event_id", eventId),
        ]);
        if (minRes.error) throw minRes.error;
        if (schRes.error) throw schRes.error;

        setMinistries((minRes.data || []) as MinistryOption[]);
        const map: Record<string, string> = {};
        const current = new Set<string>();
        for (const s of schRes.data || []) {
          map[s.ministry_id] = s.id;
          current.add(s.ministry_id);
        }
        setScheduleByMinistry(map);
        setSelectedMinistries(new Set(current));
        setInitialMinistries(new Set(current));
      } catch (e: any) {
        toast({ title: "Erro ao carregar ministérios", description: e.message, variant: "destructive" });
      } finally {
        setLoadingMinistries(false);
      }
    };
    load();
  }, [open, eventId, churchId, toast]);

  const toggleMinistry = (id: string) => {
    setSelectedMinistries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!eventId) return;
    if (!title.trim() || !date || !time) {
      toast({ title: "Preencha título, data e horário", variant: "destructive" });
      return;
    }
    if (selectedMinistries.size === 0) {
      toast({ title: "Selecione ao menos um ministério", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // 1) Atualiza dados do evento
      const { error: evErr } = await supabase
        .from("events")
        .update({
          title: title.trim(),
          event_date: date,
          start_time: time.length === 5 ? `${time}:00` : time,
          description: location || null,
        })
        .eq("id", eventId);
      if (evErr) throw evErr;

      // 2) Ministérios a adicionar (nova escala) e a remover (deleta escala)
      const toAdd = [...selectedMinistries].filter((id) => !initialMinistries.has(id));
      const toRemove = [...initialMinistries].filter((id) => !selectedMinistries.has(id));

      if (toAdd.length > 0) {
        const rows = toAdd.map((ministry_id) => ({
          event_id: eventId,
          ministry_id,
          status: "draft" as const,
        }));
        const { error: addErr } = await supabase.from("schedules").insert(rows);
        if (addErr) throw addErr;
      }

      if (toRemove.length > 0) {
        const ids = toRemove
          .map((mid) => scheduleByMinistry[mid])
          .filter((v): v is string => !!v);
        if (ids.length > 0) {
          // schedule_assignments tem CASCADE via FK, mas removemos explicitamente
          // para evitar depender de configuração e manter idempotência.
          await supabase.from("schedule_assignments").delete().in("schedule_id", ids);
          const { error: delErr } = await supabase.from("schedules").delete().in("id", ids);
          if (delErr) throw delErr;
        }
      }

      toast({ title: "Escala atualizada", description: "Voluntários serão notificados das mudanças." });
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar escala</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Título</Label>
            <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-date">Data</Label>
              <Input id="edit-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-time">Horário</Label>
              <Input id="edit-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-location">Local / observação</Label>
            <Input id="edit-location" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Ministérios</Label>
            {loadingMinistries ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : ministries.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum ministério cadastrado.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1 rounded-md border border-border p-2">
                {ministries.map((m) => {
                  const checked = selectedMinistries.has(m.id);
                  const wasInitial = initialMinistries.has(m.id);
                  return (
                    <label
                      key={m.id}
                      className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleMinistry(m.id)}
                      />
                      <span className="text-sm flex-1">{m.name}</span>
                      {wasInitial && !checked && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
                          Será removido
                        </span>
                      )}
                      {!wasInitial && checked && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                          Novo
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Ao remover um ministério, a escala correspondente e as escalações dos voluntários serão excluídas.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
