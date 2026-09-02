import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, X, Loader2, Trash2, AlertTriangle, ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Ministry {
  id: string;
  name: string;
  color: string;
}

interface MinistryRole {
  id: string;
  name: string;
  ministry_id: string;
}

interface DateSlot {
  date: Date;
  time: string;
}

// quotas per (ministryId, roleId|"_general"): how many volunteers needed
type Quotas = Record<string, Record<string, number>>;

export interface SchedulePrefill {
  title?: string;
  location?: string;
  ministryIds?: string[];
  quotas?: Quotas;
}

interface CreateScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  churchId: string;
  prefill?: SchedulePrefill;
}

export function CreateScheduleDialog({
  open,
  onOpenChange,
  onSuccess,
  churchId,
  prefill,
}: CreateScheduleDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [rolesByMinistry, setRolesByMinistry] = useState<Record<string, MinistryRole[]>>({});
  const [memberCountByMinistry, setMemberCountByMinistry] = useState<Record<string, number>>({});
  const [selectedMinistries, setSelectedMinistries] = useState<string[]>([]);
  const [quotas, setQuotas] = useState<Quotas>({});

  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [defaultTime, setDefaultTime] = useState("09:00");
  const [slots, setSlots] = useState<DateSlot[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (open && churchId) fetchMinistries();
  }, [open, churchId]);

  useEffect(() => {
    if (open && prefill) {
      if (prefill.title) setTitle(prefill.title);
      if (prefill.location) setLocation(prefill.location);
      if (prefill.ministryIds && prefill.ministryIds.length > 0) {
        setSelectedMinistries(prefill.ministryIds);
        prefill.ministryIds.forEach((id) => { ensureMinistryData(id); });
      }
      if (prefill.quotas) setQuotas(prefill.quotas);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fetchMinistries = async () => {
    const { data } = await supabase
      .from("ministries")
      .select("id, name, color")
      .eq("church_id", churchId)
      .order("name");
    if (data) setMinistries(data);
  };

  const ensureMinistryData = async (id: string) => {
    if (rolesByMinistry[id] && memberCountByMinistry[id] !== undefined) return;
    const [{ data: roles }, { count }] = await Promise.all([
      supabase.from("ministry_roles").select("id, name, ministry_id").eq("ministry_id", id),
      supabase.from("ministry_members").select("*", { count: "exact", head: true }).eq("ministry_id", id),
    ]);
    setRolesByMinistry((p) => ({ ...p, [id]: roles || [] }));
    setMemberCountByMinistry((p) => ({ ...p, [id]: count || 0 }));
    // initialize quotas: 1 per role, or 1 general if no roles
    setQuotas((p) => {
      if (p[id]) return p;
      const initial: Record<string, number> = {};
      if (roles && roles.length > 0) {
        roles.forEach((r) => (initial[r.id] = 1));
      } else {
        initial["_general"] = 1;
      }
      return { ...p, [id]: initial };
    });
  };

  const toggleMinistry = async (id: string) => {
    if (selectedMinistries.includes(id)) {
      setSelectedMinistries((p) => p.filter((m) => m !== id));
    } else {
      setSelectedMinistries((p) => [...p, id]);
      await ensureMinistryData(id);
    }
  };

  const setQuota = (ministryId: string, roleKey: string, value: number) => {
    setQuotas((p) => ({
      ...p,
      [ministryId]: { ...(p[ministryId] || {}), [roleKey]: Math.max(0, Math.min(100, value)) },
    }));
  };

  const handleSelectDates = (dates: Date[] | undefined) => {
    const newDates = dates || [];
    setSlots((prev) => {
      const map = new Map(prev.map((s) => [s.date.toDateString(), s]));
      const result: DateSlot[] = [];
      for (const d of newDates) {
        const key = d.toDateString();
        result.push(map.get(key) || { date: d, time: defaultTime });
      }
      result.sort((a, b) => a.date.getTime() - b.date.getTime());
      return result;
    });
  };

  const updateSlotTime = (idx: number, time: string) => {
    setSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, time } : s)));
  };

  const removeSlot = (idx: number) => setSlots((p) => p.filter((_, i) => i !== idx));

  // Pick volunteers with fair rotation (oldest last assignment first)
  const pickFairCandidates = (
    candidateIds: string[],
    lastAssignmentMap: Map<string, number>,
    used: Set<string>,
    count: number
  ): string[] => {
    const eligible = candidateIds.filter((u) => !used.has(u));
    eligible.sort((a, b) => {
      const ta = lastAssignmentMap.get(a) ?? 0;
      const tb = lastAssignmentMap.get(b) ?? 0;
      return ta - tb; // oldest first
    });
    return eligible.slice(0, count);
  };

  const autoAssignFor = async (
    ministryId: string,
    eventDate: string
  ): Promise<{ userId: string; roleId?: string }[]> => {
    const roles = rolesByMinistry[ministryId] || [];
    const ministryQuotas = quotas[ministryId] || {};

    const { data: membersData } = await supabase
      .from("ministry_members")
      .select("id, user_id")
      .eq("ministry_id", ministryId);
    if (!membersData || membersData.length === 0) return [];

    const memberIds = membersData.map((m) => m.id);
    const { data: memberRolesData } = await supabase
      .from("member_roles")
      .select("member_id, role_id")
      .in("member_id", memberIds);

    const memberIdToUserId = new Map(membersData.map((m) => [m.id, m.user_id]));
    const hasMemberRoles = !!(memberRolesData && memberRolesData.length > 0);
    const roleToUsers = new Map<string, string[]>();
    if (hasMemberRoles) {
      for (const mr of memberRolesData!) {
        const uid = memberIdToUserId.get(mr.member_id);
        if (!uid) continue;
        const list = roleToUsers.get(mr.role_id) || [];
        list.push(uid);
        roleToUsers.set(mr.role_id, list);
      }
    }

    const { data: unavailData } = await supabase
      .from("volunteer_availability")
      .select("user_id")
      .lte("start_date", eventDate)
      .gte("end_date", eventDate);
    const unavailableUserIds = new Set((unavailData || []).map((u) => u.user_id));

    const { data: existingSchedules } = await supabase
      .from("schedules")
      .select(`id, events!inner (event_date)`)
      .eq("events.event_date", eventDate);

    let alreadyScheduled = new Set<string>();
    if (existingSchedules && existingSchedules.length > 0) {
      const ids = existingSchedules.map((s) => s.id);
      const { data: ex } = await supabase
        .from("schedule_assignments")
        .select("user_id")
        .in("schedule_id", ids);
      alreadyScheduled = new Set((ex || []).map((a) => a.user_id));
    }

    const allUserIds = membersData.map((m) => m.user_id);
    const available = allUserIds.filter(
      (uid) => !unavailableUserIds.has(uid) && !alreadyScheduled.has(uid)
    );

    // Fair rotation: fetch last assignment per user in this ministry
    const { data: lastAssigns } = await supabase
      .from("schedule_assignments")
      .select("user_id, created_at, schedules!inner(ministry_id)")
      .eq("schedules.ministry_id", ministryId)
      .in("user_id", allUserIds)
      .order("created_at", { ascending: false });
    const lastAssignmentMap = new Map<string, number>();
    for (const a of lastAssigns || []) {
      if (!lastAssignmentMap.has(a.user_id)) {
        lastAssignmentMap.set(a.user_id, new Date(a.created_at).getTime());
      }
    }

    const result: { userId: string; roleId?: string }[] = [];
    const used = new Set<string>();

    if (roles.length > 0) {
      for (const role of roles) {
        const need = ministryQuotas[role.id] ?? 0;
        if (need <= 0) continue;
        const pool = hasMemberRoles ? (roleToUsers.get(role.id) || []).filter((u) => available.includes(u)) : available;
        const picked = pickFairCandidates(pool, lastAssignmentMap, used, need);
        for (const uid of picked) {
          result.push({ userId: uid, roleId: role.id });
          used.add(uid);
        }
      }
    } else {
      const need = ministryQuotas["_general"] ?? available.length;
      const picked = pickFairCandidates(available, lastAssignmentMap, used, need);
      for (const uid of picked) result.push({ userId: uid });
    }

    return result;
  };

  const totalQuotaFor = (ministryId: string): number => {
    const q = quotas[ministryId] || {};
    return Object.values(q).reduce((a, b) => a + b, 0);
  };

  const validateCapacity = (): string[] => {
    const warnings: string[] = [];
    for (const mid of selectedMinistries) {
      const total = totalQuotaFor(mid);
      const count = memberCountByMinistry[mid] || 0;
      const name = ministries.find((m) => m.id === mid)?.name || "";
      if (total === 0) {
        warnings.push(`${name}: nenhuma vaga definida`);
      } else if (count === 0) {
        warnings.push(`${name}: nenhum membro cadastrado`);
      } else if (total > count) {
        warnings.push(`${name}: ${total} vagas para apenas ${count} membro(s)`);
      }
    }
    return warnings;
  };

  const handleSubmit = async (publish: boolean) => {
    if (!title || slots.length === 0 || selectedMinistries.length === 0) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha título, ao menos uma data e um ministério.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    let createdCount = 0;
    let totalAssignments = 0;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      for (const slot of slots) {
        const eventDate = format(slot.date, "yyyy-MM-dd");

        const { data: event, error: eventError } = await supabase
          .from("events")
          .insert({
            title,
            event_date: eventDate,
            start_time: slot.time,
            church_id: churchId,
            created_by: user.id,
            description: location,
          })
          .select()
          .single();
        if (eventError) throw eventError;

        for (const ministryId of selectedMinistries) {
          const { data: schedule, error: scheduleError } = await supabase
            .from("schedules")
            .insert({
              event_id: event.id,
              ministry_id: ministryId,
              created_by: user.id,
              status: publish ? "published" : "draft",
              published_at: publish ? new Date().toISOString() : null,
            })
            .select()
            .single();
          if (scheduleError) throw scheduleError;

          // Save quotas
          const ministryQuotas = quotas[ministryId] || {};
          const quotaRows = Object.entries(ministryQuotas)
            .filter(([, qty]) => qty > 0)
            .map(([roleKey, qty]) => ({
              schedule_id: schedule.id,
              role_id: roleKey === "_general" ? null : roleKey,
              quantity: qty,
            }));
          if (quotaRows.length > 0) {
            await supabase.from("schedule_role_quotas").insert(quotaRows);
          }

          const auto = await autoAssignFor(ministryId, eventDate);
          if (auto.length > 0) {
            const assignments = auto.map((a) => ({
              schedule_id: schedule.id,
              user_id: a.userId,
              role_id: a.roleId || null,
              status: "pending" as const,
            }));
            const { error: aErr } = await supabase
              .from("schedule_assignments")
              .insert(assignments);
            if (aErr) throw aErr;
            totalAssignments += auto.length;
          }
          createdCount++;
        }
      }

      toast({
        title: publish ? "Escalas publicadas" : "Rascunhos salvos",
        description: `${createdCount} escala(s) com ${totalAssignments} voluntário(s).`,
      });

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast({
        title: "Erro ao criar escalas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setTitle("");
    setLocation("");
    setDefaultTime("09:00");
    setSlots([]);
    setSelectedMinistries([]);
    setQuotas({});
  };

  const canAdvance = title && slots.length > 0;
  const warnings = validateCapacity();

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? "Nova Escala — Evento" : "Nova Escala — Ministérios e Vagas"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Passo {step} de 2
          </p>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Nome do Evento</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Culto Dominical, Ensaio"
              />
            </div>

            <div className="space-y-2">
              <Label>Local (opcional)</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ex: Templo Principal"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label>Data e Horário {slots.length > 1 && `(${slots.length})`}</Label>
                {slots.length > 1 && (
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Horário padrão</Label>
                    <Input
                      type="time"
                      value={defaultTime}
                      onChange={(e) => setDefaultTime(e.target.value)}
                      className="w-28 h-8"
                    />
                  </div>
                )}
              </div>

              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      slots.length === 0 && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {slots.length === 0
                      ? "Selecione uma ou mais datas"
                      : `${slots.length} data(s) selecionada(s)`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="multiple"
                    selected={slots.map((s) => s.date)}
                    onSelect={handleSelectDates}
                    locale={ptBR}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

              {slots.length > 0 && (
                <div className="space-y-2 mt-2 max-h-56 overflow-y-auto pr-1">
                  {slots.map((slot, idx) => (
                    <div
                      key={slot.date.toISOString()}
                      className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30"
                    >
                      <CalendarIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium flex-1 capitalize">
                        {format(slot.date, "EEE, dd/MM/yyyy", { locale: ptBR })}
                      </span>
                      <Input
                        type="time"
                        value={slot.time}
                        onChange={(e) => updateSlotTime(idx, e.target.value)}
                        className="w-28 h-8"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-destructive shrink-0"
                        onClick={() => removeSlot(idx)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={() => setStep(2)} disabled={!canAdvance} className="flex-1">
                Continuar
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Ministérios {selectedMinistries.length > 0 && `(${selectedMinistries.length})`}</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {ministries.map((m) => {
                  const checked = selectedMinistries.includes(m.id);
                  return (
                    <label
                      key={m.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                        checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                      )}
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggleMinistry(m.id)} />
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: m.color || "#5B7BFF" }}
                      />
                      <span className="text-sm font-medium truncate">{m.name}</span>
                    </label>
                  );
                })}
                {ministries.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4 col-span-full">
                    Nenhum ministério cadastrado
                  </p>
                )}
              </div>
            </div>

            {selectedMinistries.length > 0 && (
              <div className="space-y-3">
                <Label>Vagas por função</Label>
                {selectedMinistries.map((mid) => {
                  const m = ministries.find((x) => x.id === mid);
                  const roles = rolesByMinistry[mid] || [];
                  const mq = quotas[mid] || {};
                  const total = totalQuotaFor(mid);
                  const count = memberCountByMinistry[mid] || 0;
                  return (
                    <div key={mid} className="p-3 rounded-lg border space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: m?.color || "#5B7BFF" }}
                          />
                          <span className="text-sm font-medium">{m?.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {count} membro(s) · {total} vaga(s)
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {roles.length > 0 ? (
                          roles.map((r) => (
                            <div key={r.id} className="flex items-center gap-2">
                              <Label className="text-xs flex-1 truncate">{r.name}</Label>
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                value={mq[r.id] ?? 0}
                                onChange={(e) => setQuota(mid, r.id, parseInt(e.target.value) || 0)}
                                className="w-16 h-8"
                              />
                            </div>
                          ))
                        ) : (
                          <div className="flex items-center gap-2 col-span-2">
                            <Label className="text-xs flex-1">Voluntários (sem funções definidas)</Label>
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={mq["_general"] ?? 1}
                              onChange={(e) => setQuota(mid, "_general", parseInt(e.target.value) || 0)}
                              className="w-16 h-8"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {warnings.length > 0 && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-sm space-y-1">
                <div className="flex items-center gap-2 font-medium text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                  Atenção
                </div>
                {warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-700 dark:text-amber-400">• {w}</p>
                ))}
              </div>
            )}

            {slots.length > 0 && selectedMinistries.length > 0 && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm">
                <Badge variant="secondary">
                  {slots.length * selectedMinistries.length} escala(s) serão criadas
                </Badge>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button variant="ghost" onClick={() => setStep(1)} disabled={loading}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <Button
                variant="outline"
                onClick={() => handleSubmit(false)}
                disabled={loading || selectedMinistries.length === 0}
                className="flex-1"
              >
                Salvar rascunho
              </Button>
              <Button
                onClick={() => handleSubmit(true)}
                disabled={loading || selectedMinistries.length === 0}
                className="flex-1"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Publicar e notificar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
