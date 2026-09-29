import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { WEEKDAYS } from "@/lib/recurrence";
import { getInitials } from "@/lib/utils";
import { useMinistries } from "@/hooks/useMinistries";
import { useRecurringAssignments, type RecurringAssignment } from "@/hooks/useRecurringAssignments";
import { RecurringAssignmentDialog } from "./RecurringAssignmentDialog";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────
// LÊ A DATA DO REGISTRO — testa os nomes de coluna mais comuns.
// Se o seu hook usar outro nome, adicione-o no início do array.
// ─────────────────────────────────────────────────────────────
const DATE_FIELDS = [
  "date",
  "event_date",
  "start_date",
  "anchor_date",
  "occurrence_date",
  "schedule_date",
  "data",
];

function getRowDate(row: RecurringAssignment): string | null {
  for (const key of DATE_FIELDS) {
    const val = (row as any)[key];
    if (typeof val === "string" && val.length >= 10) return val.substring(0, 10);
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// Helpers de data (fuso seguro: evita o bug do new Date("ISO"))
// ─────────────────────────────────────────────────────────────
function parseISODate(date?: string | null): Date | null {
  if (!date) return null;
  const [y, m, d] = date.substring(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDateLabel(date?: string | null): string {
  const dt = parseISODate(date);
  return dt ? dt.toLocaleDateString("pt-BR") : "Sem data";
}

function formatWeekdayLabel(date?: string | null): string {
  const dt = parseISODate(date);
  if (!dt) return "";
  return WEEKDAYS.find((w) => w.value === dt.getDay())?.label ?? "";
}

// ─────────────────────────────────────────────────────────────
// Horário → Ministério → Voluntários
// ─────────────────────────────────────────────────────────────
function groupByTimeAndMinistry(rows: RecurringAssignment[]) {
  const timeMap = new Map<string, RecurringAssignment[]>();

  for (const row of rows) {
    const time = row.time ? row.time.substring(0, 5) : "Sem horário";
    if (!timeMap.has(time)) timeMap.set(time, []);
    timeMap.get(time)!.push(row);
  }

  return Array.from(timeMap.entries())
    .sort(([a], [b]) => {
      if (a === "Sem horário") return 1;
      if (b === "Sem horário") return -1;
      return a.localeCompare(b);
    })
    .map(([time, timeRows]) => {
      const ministryMap = new Map<string, RecurringAssignment[]>();
      for (const row of timeRows) {
        const ministry = row.ministryName || "Sem ministério";
        if (!ministryMap.has(ministry)) ministryMap.set(ministry, []);
        ministryMap.get(ministry)!.push(row);
      }

      return {
        time,
        total: timeRows.length,
        ministries: Array.from(ministryMap.entries())
          .map(([ministryName, ministryRows]) => ({
            ministryName,
            color: ministryRows[0]?.ministryColor,
            rows: [...ministryRows].sort((a, b) =>
              (a.userName || "").localeCompare(b.userName || ""),
            ),
          }))
          .sort((a, b) => a.ministryName.localeCompare(b.ministryName)),
      };
    });
}

// ─────────────────────────────────────────────────────────────
// Agrupa pela DATA do registro (fonte única de verdade)
// ─────────────────────────────────────────────────────────────
function groupByDate(rows: RecurringAssignment[]) {
  const dateMap = new Map<string, RecurringAssignment[]>();

  for (const row of rows) {
    const key = getRowDate(row) ?? "sem-data";
    if (!dateMap.has(key)) dateMap.set(key, []);
    dateMap.get(key)!.push(row);
  }

  return Array.from(dateMap.entries())
    .sort(([a], [b]) => {
      if (a === "sem-data") return 1;
      if (b === "sem-data") return -1;
      return a.localeCompare(b);
    })
    .map(([dateKey, dateRows]) => ({
      dateKey,
      dateLabel: dateKey === "sem-data" ? "Sem data" : formatDateLabel(dateKey),
      weekdayLabel: dateKey === "sem-data" ? "" : formatWeekdayLabel(dateKey),
      total: dateRows.length,
      timeGroups: groupByTimeAndMinistry(dateRows),
    }));
}

interface Props {
  churchId: string | null;
  ministryFilter?: string;
  weekday: string;
  onWeekdayChange: (val: string) => void;
  onCreateReady?: (handler: () => void) => void;
}

export function RecurringScheduleConfig({
  churchId,
  ministryFilter = "Todas",
  weekday,
  onWeekdayChange,
  onCreateReady,
}: Props) {
  const queryClient = useQueryClient();
  const { ministries, loading: ministriesLoading } = useMinistries(churchId);
  const { items, loading, saving, save, remove, toggleActive } = useRecurringAssignments(churchId);

  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [monthString, setMonthString] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<RecurringAssignment | null>(null);

  // 🔍 TEMPORÁRIO — descubra o nome real do campo de data no console
  useEffect(() => {
    if (items.length) {
      console.log("🔍 Campos disponíveis:", Object.keys(items[0]));
      console.log("🔍 Registro completo:", items[0]);
    }
  }, [items]);

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

  const monthLabel = useMemo(() => {
    const [y, m] = monthString.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }, [monthString]);

  const visible = useMemo(() => {
    const [y, m] = monthString.split("-").map(Number);
    const prefix = `${y}-${String(m).padStart(2, "0")}`;

    return items.filter((i) => {
      const rowDate = getRowDate(i);
      const matchesMonth = !rowDate || rowDate.substring(0, 7) === prefix;
      const matchesWeekday =
        weekday === "all" || parseISODate(rowDate)?.getDay() === Number(weekday);
      const matchesMinistry = !selectedMinistryId || i.ministry_id === selectedMinistryId;
      return matchesMonth && matchesWeekday && matchesMinistry;
    });
  }, [items, monthString, weekday, selectedMinistryId]);

  const dateGroups = useMemo(() => groupByDate(visible), [visible]);

  const handleMonthChange = (offset: number) => {
    const [y, m] = monthString.split("-").map(Number);
    const d = new Date(y, m - 1 + offset, 1);
    setMonthString(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  useEffect(() => {
    onCreateReady?.(() => {
      setEditing(null);
      setShowDialog(true);
    });
  }, [onCreateReady]);

  if (loading || ministriesLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {ministryFilter === "Todas" && (
        <div className="rounded-xl border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
          Exibindo as escalas de <strong className="text-foreground">todos os ministérios</strong>. Selecione um
          ministério no filtro acima para configurar apenas ele.
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/60 p-3 sm:flex-row sm:items-center">
        <Select value={weekday} onValueChange={onWeekdayChange}>
          <SelectTrigger className="h-10 w-full sm:w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as datas</SelectItem>
            {WEEKDAYS.map((w) => (
              <SelectItem key={w.value} value={String(w.value)}>
                {w.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex h-10 items-center justify-between rounded-lg border border-border bg-background px-1 shadow-sm sm:w-[220px]">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => handleMonthChange(-1)}
            title="Mês anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <Input
            type="month"
            value={monthString}
            onChange={(e) => {
              if (e.target.value) setMonthString(e.target.value);
            }}
            className="h-8 w-full border-0 bg-transparent px-1 text-center font-semibold shadow-none focus-visible:ring-0 cursor-pointer"
            aria-label="Mês das escalas"
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => handleMonthChange(1)}
            title="Próximo mês"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {visible.length > 0 ? (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-3 border-b">
              <h3 className="text-base font-bold text-foreground capitalize">Escalas — {monthLabel}</h3>
              <Badge variant="secondary">{visible.length} agendamento(s)</Badge>
            </div>

            <div className="space-y-4">
              {dateGroups.map((g) => (
                <div key={g.dateKey} className="rounded-xl border bg-muted/20 p-3 space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground border-b pb-2">
                    <span className="flex items-center gap-1.5 text-foreground font-medium">
                      📅 {g.dateLabel}
                      {g.weekdayLabel && (
                        <Badge variant="outline" className="ml-1.5">
                          {g.weekdayLabel}
                        </Badge>
                      )}
                    </span>
                    <span>{g.total} voluntário(s)</span>
                  </div>

                  {g.timeGroups.map((tg) => (
                    <div key={tg.time} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">🕒 {tg.time}</span>
                        <span className="text-xs text-muted-foreground">({tg.total})</span>
                      </div>

                      {tg.ministries.map((mg) => (
                        <div
                          key={`${tg.time}-${mg.ministryName}`}
                          className="rounded-lg border border-border/60 bg-card/60 p-2 space-y-2"
                        >
                          <div className="flex items-center gap-2 border-b border-dashed pb-1.5">
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: mg.color }}
                            />
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {mg.ministryName}
                            </span>
                            <span className="ml-auto text-xs text-muted-foreground">{mg.rows.length}</span>
                          </div>

                          <div className="space-y-2 pt-1">
                            {mg.rows.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center gap-3 p-2.5 rounded-xl bg-card border shadow-sm"
                              >
                                <div
                                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-primary-foreground shrink-0"
                                  style={{ backgroundColor: item.ministryColor }}
                                >
                                  {getInitials(item.userName || "")}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-foreground truncate">{item.userName}</p>
                                  {item.roleName && (
                                    <p className="text-xs text-muted-foreground truncate">{item.roleName}</p>
                                  )}
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
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
            Nenhuma escala cadastrada para este período. Use o botão de criar para adicionar um voluntário
            informando a data do culto.
          </div>
        )}
      </div>

      <RecurringAssignmentDialog
        open={showDialog}
        onOpenChange={(v) => {
          setShowDialog(v);
          if (!v) setEditing(null);
        }}
        ministries={ministryOptions}
        members={members}
        editing={editing}
        saving={saving}
        onSave={async (i) => {
          const ok = await save(i);

          if (ok) {
            setShowDialog(false);
            setEditing(null);
            await queryClient.invalidateQueries();
            toast.success("Escala salva!");
          }
          return ok;
        }}
      />
    </div>
  );
}