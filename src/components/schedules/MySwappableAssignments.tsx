import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeftRight, Calendar, Clock, Music, Repeat } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSwapRequest } from "@/hooks/useSwapRequest";
import { SwapRequestDialog } from "./SwapRequestDialog";

interface MyAssignment {
  id: string;
  schedule_id: string;
  ministry_id: string;
  ministry_name: string;
  event_title: string;
  event_date: string;
  start_time: string | null;
  status: string;
  isRecurring: boolean;
}

function parseLocalDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function MySwappableAssignments({ onRequested }: { onRequested?: () => void }) {
  const [assignments, setAssignments] = useState<MyAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MyAssignment | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const {
    availableUsers,
    loading: usersLoading,
    swapping,
    fetchAvailableUsers,
    requestSwap,
    setAvailableUsers,
  } = useSwapRequest();

  const fetchMine = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: rows } = await supabase
        .from("schedule_assignments")
        .select("id, schedule_id, status, recurring_id")
        .eq("user_id", user.id);

      const list = (rows || []).filter((r: any) => r.status !== "declined");
      if (list.length === 0) {
        setAssignments([]);
        return;
      }

      const scheduleIds = [...new Set(list.map((r: any) => r.schedule_id))];
      const { data: schedules } = await supabase
        .from("schedules")
        .select("id, event_id, ministry_id")
        .in("id", scheduleIds);

      const eventIds = [...new Set((schedules || []).map((s) => s.event_id))];
      const ministryIds = [...new Set((schedules || []).map((s) => s.ministry_id))];

      const [{ data: events }, { data: ministries }] = await Promise.all([
        supabase.from("events").select("id, title, event_date, start_time").in("id", eventIds.length ? eventIds : ["00000000-0000-0000-0000-000000000000"]),
        supabase.from("ministries").select("id, name").in("id", ministryIds.length ? ministryIds : ["00000000-0000-0000-0000-000000000000"]),
      ]);

      const scheduleMap = new Map((schedules || []).map((s) => [s.id, s]));
      const eventMap = new Map((events || []).map((e) => [e.id, e]));
      const ministryMap = new Map((ministries || []).map((m) => [m.id, m]));

      const todayStr = format(new Date(), "yyyy-MM-dd");

      const mapped: MyAssignment[] = list
        .map((r: any) => {
          const schedule = scheduleMap.get(r.schedule_id);
          if (!schedule) return null;
          const event = eventMap.get(schedule.event_id);
          if (!event || event.event_date < todayStr) return null;
          return {
            id: r.id,
            schedule_id: r.schedule_id,
            ministry_id: schedule.ministry_id,
            ministry_name: ministryMap.get(schedule.ministry_id)?.name || "",
            event_title: event.title,
            event_date: event.event_date,
            start_time: event.start_time,
            status: r.status,
            isRecurring: !!r.recurring_id,
          } as MyAssignment;
        })
        .filter(Boolean) as MyAssignment[];

      mapped.sort((a, b) => a.event_date.localeCompare(b.event_date));
      setAssignments(mapped);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMine();
  }, [fetchMine]);

  const openSwap = async (assignment: MyAssignment) => {
    setSelected(assignment);
    setAvailableUsers([]);
    setDialogOpen(true);
    await fetchAvailableUsers(assignment.schedule_id, assignment.ministry_id);
  };

  const handleRequest = async (userId: string, userName: string) => {
    if (!selected) return;
    const info = `${selected.event_title} — ${format(parseLocalDate(selected.event_date), "dd/MM/yyyy", { locale: ptBR })}`;
    const ok = await requestSwap(selected.id, selected.schedule_id, userId, userName, info);
    if (ok) {
      setDialogOpen(false);
      setSelected(null);
      fetchMine();
      onRequested?.();
    }
  };

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <ArrowLeftRight className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
          Solicitar troca
        </h2>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Escolha uma das suas próximas escalas (inclusive escalas fixas) e peça a troca.
      </p>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : assignments.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Você não tem escalas futuras para solicitar troca.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => (
            <Card key={a.id}>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-foreground truncate">
                      {a.event_title}
                    </p>
                    {a.isRecurring && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Repeat className="w-3 h-3" />
                        Escala fixa
                      </Badge>
                    )}
                    {a.status === "pending_swap" && (
                      <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">
                        Troca solicitada
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(parseLocalDate(a.event_date), "dd MMM yyyy", { locale: ptBR })}
                    </span>
                    {a.start_time && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {a.start_time.slice(0, 5)}
                      </span>
                    )}
                    {a.ministry_name && (
                      <span className="flex items-center gap-1">
                        <Music className="w-3 h-3" />
                        {a.ministry_name}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={a.status === "pending_swap" ? "outline" : "default"}
                  className="h-11 sm:h-9 w-full sm:w-auto"
                  onClick={() => openSwap(a)}
                >
                  <ArrowLeftRight className="w-4 h-4 mr-1" />
                  {a.status === "pending_swap" ? "Trocar novamente" : "Solicitar troca"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SwapRequestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        availableUsers={availableUsers}
        loading={usersLoading}
        swapping={swapping}
        onRequestSwap={handleRequest}
      />
    </section>
  );
}
