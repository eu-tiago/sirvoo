import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useChurchId } from "@/hooks/useChurchId";
import { Card } from "@/components/ui/card";
import { Users } from "lucide-react";

type EventOpt = { id: string; title: string; event_date: string };
type Member = { user_id: string; role: string; name: string };

const isWorship = (n?: string | null) => {
  if (!n) return false;
  const s = n.toLowerCase();
  return s.includes("louvor") || s.includes("worship") || s.includes("músic") || s.includes("music");
};

export function TeamTab() {
  const { churchId } = useChurchId();
  const [events, setEvents] = useState<EventOpt[]>([]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [team, setTeam] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!churchId) return;
    (async () => {
      const { data } = await supabase
        .from("events")
        .select("id,title,event_date")
        .eq("church_id", churchId)
        .order("event_date", { ascending: false })
        .limit(50);
      setEvents((data ?? []) as EventOpt[]);
      if (data && data.length && !eventId) setEventId(data[0].id);
    })();
  }, [churchId]);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      setLoading(true);
      const { data: schedules } = await supabase
        .from("schedules")
        .select("id, ministries(name)")
        .eq("event_id", eventId);

      const worshipSchedules = (schedules ?? []).filter((s: any) => isWorship(s.ministries?.name));
      if (worshipSchedules.length === 0) {
        setTeam([]); setLoading(false); return;
      }

      const scheduleIds = worshipSchedules.map((s: any) => s.id);
      const { data: assigns } = await supabase
        .from("schedule_assignments")
        .select("user_id, role")
        .in("schedule_id", scheduleIds);

      const userIds = Array.from(new Set((assigns ?? []).map((a: any) => a.user_id)));
      const { data: profiles } = await supabase
        .from("safe_profiles" as any)
        .select("id, full_name")
        .in("id", userIds);

      const nameById = new Map<string, string>();
      (profiles ?? []).forEach((p: any) => nameById.set(p.id, p.full_name ?? "Sem nome"));

      setTeam(
        (assigns ?? []).map((a: any) => ({
          user_id: a.user_id,
          role: a.role ?? "Sem função",
          name: nameById.get(a.user_id) ?? "Sem nome",
        }))
      );
      setLoading(false);
    })();
  }, [eventId]);

  const grouped = team.reduce<Record<string, Member[]>>((acc, m) => {
    (acc[m.role] ||= []).push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Users className="w-4 h-4" /> Evento
        </div>
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm flex-1"
          value={eventId ?? ""}
          onChange={(e) => setEventId(e.target.value || null)}
        >
          <option value="">Selecione</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {new Date(e.event_date + "T00:00:00").toLocaleDateString("pt-BR")} — {e.title}
            </option>
          ))}
        </select>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : Object.keys(grouped).length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma equipe de louvor escalada para este evento.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {Object.entries(grouped).map(([role, members]) => (
            <Card key={role} className="p-4">
              <p className="text-xs uppercase font-semibold text-muted-foreground mb-2">{role} ({members.length})</p>
              <div className="space-y-2">
                {members.map((m) => (
                  <div key={m.user_id + role} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-bold text-primary-foreground">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm">{m.name}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
