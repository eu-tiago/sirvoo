import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { WEEKDAYS, OCCURRENCES, rotatingDateInMonth } from "@/lib/recurrence";
import { getInitials } from "@/lib/utils";
import { useMinistries } from "@/hooks/useMinistries";
import { useRecurringAssignments, type RecurringAssignment } from "@/hooks/useRecurringAssignments";
import { RecurringAssignmentDialog } from "./RecurringAssignmentDialog";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner"; // Adicionado para notificações

// Helper para calcular a data exata da ocorrência no mês (respeita o rodízio de 5ª semana)
const getExactDateStr = (year: number, month: number, weekday: number, occ: number) => {
  const d = rotatingDateInMonth(year, month, weekday, occ);
  if (!d) return null;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};


interface Props {
  churchId: string | null;
  ministryFilter?: string;
  weekday: string;
  onWeekdayChange: (val: string) => void;
}

export function RecurringScheduleConfig({ churchId, ministryFilter = "Todas", weekday, onWeekdayChange }: Props) {
  const queryClient = useQueryClient();
  const { ministries, loading: ministriesLoading } = useMinistries(churchId);
  const { items, loading, saving, save, remove, toggleActive, syncRange } = useRecurringAssignments(churchId);

  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [monthString, setMonthString] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<RecurringAssignment | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!churchId) return;
    (async () => {
      const { data: cm } = await supabase.from("church_members").select("user_id").eq("church_id", churchId);
      const ids = (cm || []).map((m: any) => m.user_id);
      if (!ids.length) return setMembers([]);
      const { data: profiles } = await (supabase as any).from("safe_profiles").select("id, full_name").in("id", ids);
      setMembers(
        ((profiles || []) as any[])
          .map((p) => ({ id: p.id, name: p.full_name || "Sem nome" }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    })();
  }, [churchId]);

  const ministryOptions = useMemo(
    () =>
      ministries.map((m) => ({
        id: m.id,
        name: m.name,
        roles: (m.roles || []).map((r) => ({ id: r.id, name: r.name })),
      })),
    [ministries],
  );

  const selectedMinistryId = useMemo(
    () => (ministryFilter === "Todas" ? null : (ministries.find((m) => m.name === ministryFilter)?.id ?? null)),
    [ministries, ministryFilter],
  );

  const visible = useMemo(() => {
    return items.filter((i) => {
      const matchesWeekday = weekday === "all" || i.weekday === Number(weekday);
      const matchesMinistry = !selectedMinistryId || i.ministry_id === selectedMinistryId;
      return matchesWeekday && matchesMinistry;
    });
  }, [items, weekday, selectedMinistryId]);

  // Função para avançar e voltar meses pelos botões < e >
  const handleMonthChange = (offset: number) => {
    const [y, m] = monthString.split("-").map(Number);
    const d = new Date(y, m - 1 + offset, 1);
    setMonthString(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const handleGenerateNextMonth = async () => {
    const [y, m] = monthString.split("-").map(Number);
    const fromDate = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const toDate = `${y}-${String(m).padStart(2, "0")}-${lastDay}`;
    setSyncing(true);
    await syncRange(fromDate, toDate);
    setSyncing(false);
  };

  if (loading || ministriesLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    );
  }

  const [yearStr, monthStr] = monthString.split("-");
  const refYear = parseInt(yearStr, 10);
  const refMonth = parseInt(monthStr, 10) - 1;

  return (
    <div className="space-y-4">
      {ministryFilter === "Todas" && (
        <div className="rounded-xl border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
          Exibindo as escalas fixas de <strong className="text-foreground">todos os ministérios</strong>. Selecione um
          ministério no filtro acima para configurar apenas ele.
        </div>
      )}

      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
        <Select value={weekday} onValueChange={onWeekdayChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os dias</SelectItem>
            {WEEKDAYS.map((w) => (
              <SelectItem key={w.value} value={String(w.value)}>
                {w.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center bg-card border rounded-lg p-1 shadow-sm shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => handleMonthChange(-1)}
            title="Mês Anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <Input
            type="month"
            value={monthString}
            onChange={(e) => {
              if (e.target.value) setMonthString(e.target.value);
            }}
            className="h-8 border-0 shadow-none focus-visible:ring-0 text-center font-semibold bg-transparent w-[150px] px-1 cursor-pointer"
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => handleMonthChange(1)}
            title="Próximo Mês"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex flex-1 items-center justify-end gap-2 flex-wrap">
          <Button variant="secondary" onClick={handleGenerateNextMonth} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} /> Gerar Escalas do Mês
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setShowDialog(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" /> Nova escala fixa
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {OCCURRENCES.map((occ) => {
          const occRows = visible.filter((i) => i.occurrence === occ.value);
          if (occRows.length === 0) return null;

          return (
            <div key={occ.value} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between mb-4 pb-3 border-b">
                <h3 className="text-base font-bold text-foreground">{occ.label} Semana do Mês</h3>
                <Badge variant="secondary">{occRows.length} voluntário(s)</Badge>
              </div>
              <div className="space-y-4">
                {Array.from(new Set(occRows.map((r) => r.weekday)))
                  .sort((a, b) => a - b)
                  .map((wDay) => {
                    const dayName = WEEKDAYS.find((w) => w.value === wDay)?.label || "Dia";
                    const exactDate = getExactDateStr(refYear, refMonth, wDay, occ.value);
                    const dayRows = occRows.filter((r) => r.weekday === wDay);

                    return (
                      <div key={wDay} className="rounded-xl border bg-muted/20 p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground border-b pb-2">
                          <span className="flex items-center gap-1.5 text-foreground font-medium">📅 {dayName}</span>
                          {exactDate && (
                            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md font-bold text-[10px]">
                              {exactDate}
                            </span>
                          )}
                        </div>
                        <div className="space-y-2 pt-1">
                          {dayRows.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center gap-3 p-2.5 rounded-xl bg-card border shadow-sm"
                            >
                              <div
                                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-primary-foreground"
                                style={{ backgroundColor: item.ministryColor }}
                              >
                                {getInitials(item.userName || "")}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-foreground truncate">{item.userName}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {item.ministryName} {item.roleName ? ` • ${item.roleName}` : ""}{" "}
                                  {item.time ? ` • 🕒 ${item.time.substring(0, 5)}` : ""}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <Switch checked={item.active} onCheckedChange={(v) => toggleActive(item.id, v)} />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditing(item);
                                    setShowDialog(true);
                                  }}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => remove(item.id)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>
      <RecurringAssignmentDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        ministries={ministryOptions}
        members={members}
        editing={editing}
        saving={saving}
        onSave={async (i) => {
          // 1. Usa a função original do seu hook (isso faz aparecer na tela de Planejamento de novo)
          const ok = await save(i);

          if (ok) {
            setShowDialog(false);
            try {
              toast.info("Configuração salva. Gerando escalas atualizadas...");

              const [y, m] = monthString.split("-").map(Number);
              const fromDate = `${y}-${String(m).padStart(2, "0")}-01`;
              const lastDay = new Date(y, m, 0).getDate();
              const toDate = `${y}-${String(m).padStart(2, "0")}-${lastDay}`;

              // 2. Aciona o gerador do mês
              await syncRange(fromDate, toDate);

              // 3. Dá um tempinho e atualiza tudo
              await new Promise((resolve) => setTimeout(resolve, 500));
              await queryClient.invalidateQueries();

              toast.success("Tudo certo! Escala salva.");
            } catch (err: any) {
              console.error("Erro ao sincronizar:", err);
            }
          }
          return ok;
        }}
      />
    </div>
  );
}
