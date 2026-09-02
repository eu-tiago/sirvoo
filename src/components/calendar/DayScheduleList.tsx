import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { occurrenceOfMonth, rotatingOccurrence } from "@/lib/recurrence";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Repeat, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { smartTitle } from "@/lib/scheduleLabel";

interface Member {
  name: string;
  role: string;
}

interface MinistryGroup {
  ministryId: string;
  ministry: string;
  color: string;
  members: Member[];
}

interface EventBlock {
  id: string;
  title: string;
  time: string;
  isFixed?: boolean;
  groups: MinistryGroup[];
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function DayScheduleList({ churchId, date }: { churchId: string | null; date: Date }) {
  const { user } = useAuth();
  const { isAdmin, isSuperAdmin, isLeader } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [blocks, setBlocks] = useState<EventBlock[]>([]);
  const [ministryFilter, setMinistryFilter] = useState("all");
  const [volunteerFilter, setVolunteerFilter] = useState("all");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareText, setShareText] = useState("");

  const iso = toISO(date);

  const fetchData = useCallback(async () => {
    if (!churchId || !user) return;
    setLoading(true);
    try {
      // Permissões: líder vê apenas os ministérios sob sua responsabilidade
      let allowed: Set<string> | null = null;
      if (!isAdmin && !isSuperAdmin) {
        const { data: mm } = await supabase
          .from("ministry_members")
          .select("ministry_id, is_leader")
          .eq("user_id", user.id);
        if (isLeader) {
          const leaderMins = (mm || []).filter((m: any) => m.is_leader).map((m: any) => m.ministry_id);
          allowed = new Set(leaderMins.length ? leaderMins : (mm || []).map((m: any) => m.ministry_id));
        }
      }

      const { data: eventsData } = await supabase
        .from("events")
        .select("id, title, start_time, schedules(id, ministry_id, status, ministries(name, color))")
        .eq("church_id", churchId)
        .eq("event_date", iso)
        .order("start_time", { ascending: true });

      const scheduleRows: any[] = [];
      (eventsData || []).forEach((e: any) => (e.schedules || []).forEach((s: any) => scheduleRows.push({ ...s, event: e })));
      const scheduleIds = scheduleRows.map((s) => s.id);

      let assignments: any[] = [];
      if (scheduleIds.length) {
        const { data } = await supabase
          .from("schedule_assignments")
          .select("id, schedule_id, user_id, status, role_id, ministry_roles:role_id (name)")
          .in("schedule_id", scheduleIds);
        assignments = data || [];
      }

      // Escala fixa semanal (somente para ministérios sem escala de evento na data)
      const weekday = date.getDay();
      const occ = rotatingOccurrence(date);
      const occs = occurrenceOfMonth(date) === 5 ? Array.from(new Set([occ, 5])) : [occ];

      const { data: recurring } = await supabase
        .from("recurring_assignments")
        .select("id, ministry_id, user_id, role_id, time, weekday, occurrence, start_date, end_date, active")
        .eq("church_id", churchId)
        .eq("weekday", weekday)
        .in("occurrence", occs)
        .eq("active", true);

      const validRecurring = (recurring || []).filter(
        (r: any) => (!r.start_date || r.start_date <= iso) && (!r.end_date || r.end_date >= iso),
      );

      const userIds = Array.from(
        new Set([...assignments.map((a) => a.user_id), ...validRecurring.map((r: any) => r.user_id)].filter(Boolean)),
      );
      const roleIds = Array.from(new Set(validRecurring.map((r: any) => r.role_id).filter(Boolean)));
      const recMinIds = Array.from(new Set(validRecurring.map((r: any) => r.ministry_id).filter(Boolean)));

      const [profRes, rolesRes, minRes] = await Promise.all([
        userIds.length
          ? supabase.from("safe_profiles").select("id, full_name").in("id", userIds)
          : Promise.resolve({ data: [] as any[] }),
        roleIds.length
          ? supabase.from("ministry_roles").select("id, name").in("id", roleIds)
          : Promise.resolve({ data: [] as any[] }),
        recMinIds.length
          ? supabase.from("ministries").select("id, name, color").in("id", recMinIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const nameMap = new Map((profRes.data || []).map((p: any) => [p.id, p.full_name || "Sem nome"]));
      const roleMap = new Map((rolesRes.data || []).map((r: any) => [r.id, r.name]));
      const minMap = new Map((minRes.data || []).map((m: any) => [m.id, m]));

      const result: EventBlock[] = [];
      const isManager = Boolean(isAdmin || isSuperAdmin || isLeader);

      // A escala fixa é a fonte de verdade do dia: se um ministério tem regra
      // fixa nesta data, escalas de evento antigas desse ministério não aparecem.
      const fixedByTime = new Map<string, MinistryGroup[]>();
      const ministriesWithFixed = new Set<string>();
      for (const r of validRecurring) {
        if (allowed && !allowed.has(r.ministry_id)) continue;
        const time = (r.time || "").slice(0, 5);
        ministriesWithFixed.add(r.ministry_id);
        const list = fixedByTime.get(time) || [];
        const min: any = minMap.get(r.ministry_id) || { name: "Ministério", color: "#5B7BFF" };
        let group = list.find((g) => g.ministryId === r.ministry_id);
        if (!group) {
          group = { ministryId: r.ministry_id, ministry: min.name, color: min.color || "#5B7BFF", members: [] };
          list.push(group);
        }
        group.members.push({ name: nameMap.get(r.user_id) || "Sem nome", role: roleMap.get(r.role_id) || "" });
        fixedByTime.set(time, list);
      }

      for (const e of eventsData || []) {
        const groups: MinistryGroup[] = [];
        for (const s of (e as any).schedules || []) {
          if (allowed && !allowed.has(s.ministry_id)) continue;
          if (!isManager && s.status === "draft") continue; // rascunho não aparece para voluntário
          if (ministriesWithFixed.has(s.ministry_id)) continue; // escala fixa tem prioridade

          const members = assignments
            .filter((a) => a.schedule_id === s.id && a.status !== "rejected" && a.status !== "cancelled")
            .map((a) => ({
              name: nameMap.get(a.user_id) || "Sem nome",
              role: (a.ministry_roles as any)?.name || "",
            }));
          groups.push({
            ministryId: s.ministry_id,
            ministry: s.ministries?.name || "Ministério",
            color: s.ministries?.color || "#5B7BFF",
            members,
          });
        }
        if (groups.length) {
          result.push({
            id: e.id,
            title: smartTitle(e.title, date.getDay(), e.start_time),
            time: (e.start_time || "").slice(0, 5),
            groups,
          });
        }
      }

      for (const [time, groups] of Array.from(fixedByTime.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
        result.push({
          id: `fixed-${time}`,
          title: smartTitle("Escala semanal fixa", date.getDay(), time),
          time,
          isFixed: true,
          groups,
        });
      }

      result.sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
      setBlocks(result);
    } catch (err) {
      console.error("Erro ao carregar escalas do dia:", err);
      setBlocks([]);
    } finally {
      setLoading(false);
    }
  }, [churchId, user, iso, date, isAdmin, isSuperAdmin, isLeader]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const ministryOptions = useMemo(() => {
    const map = new Map<string, string>();
    blocks.forEach((b) => b.groups.forEach((g) => map.set(g.ministryId, g.ministry)));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [blocks]);

  const volunteerOptions = useMemo(() => {
    const set = new Set<string>();
    blocks.forEach((b) => b.groups.forEach((g) => g.members.forEach((m) => set.add(m.name))));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [blocks]);

  const filtered = useMemo(() => {
    return blocks
      .map((b) => ({
        ...b,
        groups: b.groups
          .filter((g) => ministryFilter === "all" || g.ministryId === ministryFilter)
          .map((g) => ({
            ...g,
            members: volunteerFilter === "all" ? g.members : g.members.filter((m) => m.name === volunteerFilter),
          }))
          .filter((g) => volunteerFilter === "all" || g.members.length > 0),
      }))
      .filter((b) => b.groups.length > 0);
  }, [blocks, ministryFilter, volunteerFilter]);

  const buildText = () => {
    const lines: string[] = [
      `\u{1F4C5} Escala \u2013 ${format(date, "EEEE, d 'de' MMMM", { locale: ptBR })}`,
      "",
    ];
    if (filtered.length === 0) {
      lines.push("Nenhuma escala para esta data.");
    } else {
      for (const b of filtered) {
        lines.push(`${b.isFixed ? "\u{1F501}" : "\u2600\u{FE0F}"} ${b.title}${b.time ? ` | ${b.time}` : ""}`);
        lines.push("");
        for (const g of b.groups) {
          lines.push(`\u{1F539} ${g.ministry}`);
          if (g.members.length === 0) lines.push("\u2022 (sem voluntários)");
          for (const m of g.members) lines.push(`\u2022 ${m.name}${m.role ? ` \u2014 ${m.role}` : ""}`);
          lines.push("");
        }
      }
      lines.push("\u{1F64F} Contamos com vocês!");
    }
    return lines.join("\n");
  };

  const openShare = () => {
    setShareText(buildText());
    setShareOpen(true);
  };

  if (loading) return <Skeleton className="h-40 rounded-2xl" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <Select value={ministryFilter} onValueChange={setMinistryFilter}>
          <SelectTrigger className="h-11 sm:w-48">
            <SelectValue placeholder="Área" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as áreas</SelectItem>
            {ministryOptions.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={volunteerFilter} onValueChange={setVolunteerFilter}>
          <SelectTrigger className="h-11 sm:w-48">
            <SelectValue placeholder="Voluntário" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os voluntários</SelectItem>
            {volunteerOptions.map((n) => (
              <SelectItem key={n} value={n}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={openShare} className="h-11 sm:ml-auto gap-2">
          <MessageCircle className="w-4 h-4" />
          Compartilhar no WhatsApp
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="sirvo-card text-center py-8">
          <p className="text-muted-foreground">Nenhuma escala nesta data</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
            <div key={b.id} className="sirvo-card space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-foreground">{b.title}</h3>
                {b.time && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {b.time}
                  </span>
                )}
                {b.isFixed && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground flex items-center gap-1">
                    <Repeat className="w-3 h-3" /> Escala fixa
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {b.groups.map((g) => (
                  <div key={`${b.id}-${g.ministryId}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${g.color}15`, color: g.color }}
                    >
                      {g.ministry}
                    </span>
                    <span className="text-sm text-foreground">
                      {g.members.length
                        ? g.members.map((m) => (m.role ? `${m.name} (${m.role})` : m.name)).join(", ")
                        : "Sem voluntários escalados"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Compartilhar escala do dia</DialogTitle>
            <DialogDescription>Revise ou edite a mensagem antes de enviar.</DialogDescription>
          </DialogHeader>
          <Textarea value={shareText} onChange={(e) => setShareText(e.target.value)} rows={14} className="text-sm" />
          <DialogFooter>
            <Button
              className="gap-2 w-full sm:w-auto"
              onClick={() => {
                window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, "_blank");
                setShareOpen(false);
              }}
            >
              <MessageCircle className="w-4 h-4" />
              Abrir o WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
