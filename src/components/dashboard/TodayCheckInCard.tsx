import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { UserCheck, Undo2, Loader2, CalendarClock, CheckCircle2 } from "lucide-react";

interface TodayAssignment {
  id: string;
  checked_in_at: string | null;
  title: string;
  time: string | null;
  ministry: string | null;
}

interface UpcomingAssignment {
  id: string;
  title: string;
  time: string | null;
  ministry: string | null;
  eventDate: string;
}

function localTodayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatBrDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function TodayCheckInCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<TodayAssignment[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const today = localTodayStr();

      const { data: assignments } = await supabase
        .from("schedule_assignments")
        .select("id, checked_in_at, schedule_id")
        .eq("user_id", user.id)
        .in("status", ["confirmed", "pending"]);

      if (!assignments || assignments.length === 0) {
        setItems([]);
        setUpcoming(null);
        return;
      }

      const { data: schedules } = await supabase
        .from("schedules")
        .select("id, event_id, ministry_id")
        .in("id", assignments.map((a) => a.schedule_id));

      const eventIds = (schedules || []).map((s) => s.event_id);
      if (eventIds.length === 0) {
        setItems([]);
        setUpcoming(null);
        return;
      }

      // Fetch ALL events for these assignments (today + future) in one query
      const { data: allEvents } = await supabase
        .from("events")
        .select("id, title, event_date, start_time")
        .in("id", eventIds)
        .gte("event_date", today)
        .order("event_date", { ascending: true });

      const ministryIds = Array.from(
        new Set((schedules || []).map((s) => s.ministry_id).filter(Boolean) as string[])
      );
      const ministryById = new Map<string, string>();
      if (ministryIds.length > 0) {
        const { data: ministries } = await supabase
          .from("ministries")
          .select("id, name")
          .in("id", ministryIds);
        for (const m of ministries || []) ministryById.set(m.id, m.name);
      }

      const eventById = new Map((allEvents || []).map((e) => [e.id, e]));
      const scheduleById = new Map((schedules || []).map((s) => [s.id, s]));

      const todayRows: TodayAssignment[] = [];
      let nextUpcoming: UpcomingAssignment | null = null;

      // Build rows for today + track the earliest upcoming (non-today) event
      const upcomingCandidates: { ev: any; sched: any; a: any }[] = [];

      for (const a of assignments) {
        const sched = scheduleById.get(a.schedule_id);
        if (!sched) continue;
        const ev = eventById.get(sched.event_id);
        if (!ev) continue;

        if (ev.event_date === today) {
          todayRows.push({
            id: a.id,
            checked_in_at: a.checked_in_at,
            title: ev.title,
            time: ev.start_time ? String(ev.start_time).slice(0, 5) : null,
            ministry: sched.ministry_id ? ministryById.get(sched.ministry_id) ?? null : null,
          });
        } else if (ev.event_date > today) {
          upcomingCandidates.push({ ev, sched, a });
        }
      }

      todayRows.sort((a, b) => (a.time || "").localeCompare(b.time || ""));

      // Pick the earliest upcoming assignment
      upcomingCandidates.sort((x, y) => (x.ev.event_date || "").localeCompare(y.ev.event_date || ""));
      if (upcomingCandidates.length > 0) {
        const { ev, sched } = upcomingCandidates[0];
        nextUpcoming = {
          id: sched.id,
          title: ev.title,
          time: ev.start_time ? String(ev.start_time).slice(0, 5) : null,
          ministry: sched.ministry_id ? ministryById.get(sched.ministry_id) ?? null : null,
          eventDate: ev.event_date,
        };
      }

      setItems(todayRows);
      setUpcoming(nextUpcoming);
    } catch (error) {
      console.error("Error loading today's check-in:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (item: TodayAssignment) => {
    const done = !!item.checked_in_at;
    setSavingId(item.id);
    try {
      const payload = done
        ? { checked_in_at: null, checked_in_by: null }
        : { checked_in_at: new Date().toISOString(), checked_in_by: user?.id ?? null };
      const { error } = await supabase
        .from("schedule_assignments")
        .update(payload)
        .eq("id", item.id);
      if (error) throw error;
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, checked_in_at: payload.checked_in_at } : i))
      );
      toast({
        title: done ? "Check-in desfeito" : "Check-in realizado",
        description: done ? "Sua presença foi removida." : "Presença registrada. Obrigado!",
      });
    } catch (error: any) {
      toast({
        title: "Erro no check-in",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingId(null);
    }
  };

  // Always render so the check-in area is persistent and discoverable on the dashboard.
  return (
    <div className="rounded-2xl border border-border bg-card p-3 sm:p-4 space-y-3">
      <div className="flex items-center gap-2">
        <UserCheck className="w-4 h-4 text-primary" />
        <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
          Check-in do dia
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item) => {
            const done = !!item.checked_in_at;
            return (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-xl bg-muted/40 p-2.5 sm:p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {item.title}
                    {item.time ? ` · ${item.time}` : ""}
                  </p>
                  {item.ministry && (
                    <p className="text-xs text-muted-foreground truncate">{item.ministry}</p>
                  )}
                  {done && (
                    <p className="text-[11px] font-medium text-green-600 flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="w-3 h-3" /> Presença confirmada
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={done ? "outline" : "default"}
                  className="w-full sm:w-auto shrink-0 h-11 sm:h-10 font-bold text-sm"
                  disabled={savingId === item.id}
                  onClick={() => toggle(item)}
                >
                  {savingId === item.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : done ? (
                    <>
                      <Undo2 className="w-4 h-4 mr-1.5" /> Desfazer
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4 mr-1.5" /> Fazer check-in
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      ) : upcoming ? (
        <div className="flex items-center gap-3 rounded-xl bg-muted/30 p-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <CalendarClock className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {upcoming.title}
              {upcoming.time ? ` · ${upcoming.time}` : ""}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {upcoming.ministry ? `${upcoming.ministry} · ` : ""}
              {formatBrDate(upcoming.eventDate)}
            </p>
          </div>
          <span className="text-[11px] font-medium text-muted-foreground text-right max-w-[40%] leading-tight hidden sm:block">
            Check-in libera<br />no dia do evento
          </span>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground py-2">
          Nenhuma escala programada. Seu check-in aparecerá aqui no dia do evento.
        </p>
      )}
    </div>
  );
}
