import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Clock } from "lucide-react";
import { WEEKDAYS, OCCURRENCES } from "@/lib/recurrence";
import type { RecurringAssignment, RecurringInput } from "@/hooks/useRecurringAssignments";
import { supabase } from "@/integrations/supabase/client";

interface MinistryOption {
  id: string;
  name: string;
  roles: { id: string; name: string }[];
}

interface MemberOption {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ministries: MinistryOption[];
  members: MemberOption[];
  editing?: RecurringAssignment | null;
  saving?: boolean;
  onSave: (input: RecurringInput) => Promise<boolean>;
}

const NO_ROLE = "_none";

export function RecurringAssignmentDialog({ open, onOpenChange, ministries, members, editing, saving, onSave }: Props) {
  const [ministryId, setMinistryId] = useState("");
  const [userId, setUserId] = useState("");
  const [roleId, setRoleId] = useState<string>(NO_ROLE);
  const [weekday, setWeekday] = useState<string>("0");
  const [occurrence, setOccurrence] = useState<string>("1");
  // Arquitetura: Novo estado para o horário do culto
  const [time, setTime] = useState<string>("09:00");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [allowedMinistries, setAllowedMinistries] = useState<string[]>([]);
  const [loadingMinistries, setLoadingMinistries] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUserId(editing?.user_id || "");
    setMinistryId(editing?.ministry_id || "");
    setRoleId(editing?.role_id || NO_ROLE);
    setWeekday(String(editing?.weekday ?? 0));
    setOccurrence(String(editing?.occurrence ?? 1));
    // Carrega o horário ou usa um padrão
    setTime(editing?.time ? editing.time.substring(0, 5) : "09:00");
    setStartDate(editing?.start_date || "");
    setEndDate(editing?.end_date || "");
  }, [open, editing]);

  useEffect(() => {
    const fetchUserMinistries = async () => {
      if (!userId) {
        setAllowedMinistries([]);
        return;
      }

      setLoadingMinistries(true);
      const { data, error } = await supabase.from("ministry_members").select("ministry_id").eq("user_id", userId);

      if (data && !error) {
        const allowedIds = data.map((d) => d.ministry_id);
        setAllowedMinistries(allowedIds);

        if (ministryId && !allowedIds.includes(ministryId)) {
          setMinistryId("");
          setRoleId(NO_ROLE);
        }
      }
      setLoadingMinistries(false);
    };

    if (open) {
      fetchUserMinistries();
    }
  }, [userId, open]);

  const filteredMinistries = useMemo(() => {
    return ministries.filter((m) => allowedMinistries.includes(m.id));
  }, [ministries, allowedMinistries]);

  const roles = useMemo(() => ministries.find((m) => m.id === ministryId)?.roles || [], [ministries, ministryId]);

  const canSave = ministryId && userId && time;

  const handleSave = async () => {
    if (!canSave) return;
    const ok = await onSave({
      id: editing?.id,
      ministry_id: ministryId,
      user_id: userId,
      role_id: roleId === NO_ROLE ? null : roleId,
      weekday: Number(weekday),
      occurrence: Number(occurrence),
      time: time, // Delta: Enviando o horário para o hook
      start_date: startDate || null,
      end_date: endDate || null,
      active: editing?.active ?? true,
    });
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar escala fixa" : "Nova escala fixa"}</DialogTitle>
          <DialogDescription>
            Defina o voluntário, o dia e o horário do culto para a escala recorrente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Voluntário</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o voluntário" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Ministério
              {loadingMinistries && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
            </Label>
            <Select
              value={ministryId}
              onValueChange={(v) => {
                setMinistryId(v);
                setRoleId(NO_ROLE);
              }}
              disabled={!userId || loadingMinistries || filteredMinistries.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    !userId
                      ? "Selecione um voluntário primeiro"
                      : filteredMinistries.length === 0
                        ? "Voluntário sem ministérios"
                        : "Selecione o ministério"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {filteredMinistries.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Função (opcional)</Label>
            <Select value={roleId} onValueChange={setRoleId} disabled={!ministryId}>
              <SelectTrigger>
                <SelectValue placeholder="Sem função específica" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_ROLE}>Sem função específica</SelectItem>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* NOVA SEÇÃO: Dia, Ocorrência e HORÁRIO */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Dia da semana</Label>
              <Select value={weekday} onValueChange={setWeekday}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((w) => (
                    <SelectItem key={w.value} value={String(w.value)}>
                      {w.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Semana no mês</Label>
              <Select value={occurrence} onValueChange={setOccurrence}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OCCURRENCES.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> Horário
              </Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="sirvo-input"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Válida a partir de (opcional)</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Válida até (opcional)</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          {occurrence === "5" && (
            <p className="text-xs text-muted-foreground">
              A 5ª ocorrência só será gerada nos meses que realmente possuem essa data.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
