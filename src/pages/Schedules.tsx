import { useState, useMemo, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ScheduleDetailDialog } from "@/components/schedules/ScheduleDetailDialog";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Sparkles, UserCheck, Repeat, ChevronRight, Check, X, Undo2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSchedules } from "@/hooks/useSchedules";
import { useChurchId } from "@/hooks/useChurchId";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Schedules = () => {
  const isMobile = useIsMobile();
  const { churchId, loading: churchLoading } = useChurchId();
  const { schedules, loading, refetch, confirmAssignment, markUnavailable } = useSchedules(churchId);
  const [selected, setSelected] = useState<any>(null);
  const [showDetail, setShowDetail] = useState(false);
  const { toast } = useToast();
  const [checkIns, setCheckIns] = useState<Record<string, string | null>>({});
  const [checkingId, setCheckingId] = useState<string | null>(null);

  // Filtro que aceita tanto escalas de evento quanto fixas (recorrentes)
  const allMySchedules = useMemo(() => {
    if (!schedules) return [];
    // Mantemos escalas com ID de atribuição OU escalas fixas (id começando com 'rec-')
    return schedules.filter((s) => s.userAssignmentId || s.id.startsWith("rec-"));
  }, [schedules]);

  const todayStr = new Date().toISOString().split("T")[0];

  const upcoming = useMemo(() => {
    return allMySchedules
      .filter((s) => {
        // Nunca exibir datas que já passaram (inclusive escalas fixas)
        const isFuture = s.eventDate ? s.eventDate >= todayStr : true;
        const isNotUnavailable = s.userStatus !== "unavailable";
        return isFuture && isNotUnavailable;
      })
      .sort((a, b) => (a.eventDate || "").localeCompare(b.eventDate || ""));
  }, [allMySchedules, todayStr]);

  const past = useMemo(() => {
    return allMySchedules
      .filter((s) => !s.isRecurring && s.eventDate && s.eventDate < todayStr && s.userStatus === "confirmed")
      .sort((a, b) => (b.eventDate || "").localeCompare(a.eventDate || ""));
  }, [allMySchedules, todayStr]);

  const assignmentIds = useMemo(
    () => allMySchedules.map((s) => s.userAssignmentId).filter(Boolean) as string[],
    [allMySchedules],
  );

  const loadCheckIns = useCallback(async () => {
    if (assignmentIds.length === 0) return;
    const { data } = await supabase.from("schedule_assignments").select("id, checked_in_at").in("id", assignmentIds);
    const map: Record<string, string | null> = {};
    for (const a of data || []) map[a.id] = a.checked_in_at;
    setCheckIns(map);
  }, [assignmentIds]);

  useEffect(() => {
    loadCheckIns();
  }, [loadCheckIns]);

  const canCheckIn = (s: any) =>
    !s.isRecurring && s.userStatus === "confirmed" && s.userAssignmentId && s.eventDate && s.eventDate <= todayStr;

  const toggleCheckIn = async (s: any) => {
    const id = s.userAssignmentId as string;
    setCheckingId(id);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const already = checkIns[id];
      const payload = already
        ? { checked_in_at: null, checked_in_by: null }
        : { checked_in_at: new Date().toISOString(), checked_in_by: auth.user?.id ?? null };

      const { error } = await supabase.from("schedule_assignments").update(payload).eq("id", id);
      if (error) throw error;

      setCheckIns((prev) => ({ ...prev, [id]: payload.checked_in_at }));
      toast({ title: already ? "Check-in desfeito" : "Presença registrada com sucesso!" });
    } catch (error: any) {
      toast({ title: "Erro no check-in", description: error.message, variant: "destructive" });
    } finally {
      setCheckingId(null);
    }
  };

  return (
    <ProtectedRoute>
      <AppLayout>
        <header className="px-6 pt-8 pb-6 bg-gradient-to-b from-muted/50 to-transparent">
          <h1 className="text-2xl font-bold text-foreground">Minhas Escalas</h1>
          <p className="text-sm text-muted-foreground">Sua agenda de voluntariado</p>
        </header>

        <div className="px-4 md:px-6 pb-24 space-y-8">
          {loading || churchLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-40 rounded-2xl" />
              ))}
            </div>
          ) : upcoming.length > 0 ? (
            <section className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> Próximos compromissos
              </h2>
              {upcoming.map((s) => (
                <div key={s.id} className="sirvo-card relative shadow-sm hover:shadow-md transition-all">
                  <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
                    <Badge variant="secondary" className="gap-1 bg-muted/80 text-[10px]">
                      {s.isRecurring ? <Repeat className="w-3 h-3 text-primary" /> : <Calendar className="w-3 h-3" />}
                      {s.isRecurring ? "Fixa" : "Evento"}
                    </Badge>
                    {s.userStatus === "confirmed" && (
                      <Badge className="gap-1 bg-green-500/10 text-green-600 border-green-500/20 text-[10px]">
                        <Check className="w-3 h-3" /> Confirmado
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-start gap-3 mb-4">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm"
                      style={{
                        backgroundColor: (s.ministryColor || "#6366f1") + "20",
                        color: s.ministryColor || "#6366f1",
                      }}
                    >
                      {s.ministry ? s.ministry[0] : "E"}
                    </div>
                    <div>
                      <h3 className="font-bold text-base">{s.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {s.ministry} {s.userRole ? `· ${s.userRole}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground mb-4">
                    <span>📅 {s.date}</span>
                    <span>🕒 {s.time}</span>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-border">
                    {canCheckIn(s) ? (
                      <Button
                        size="sm"
                        variant={!!checkIns[s.userAssignmentId] ? "outline" : "default"}
                        className="flex-1"
                        onClick={() => toggleCheckIn(s)}
                      >
                        {!!checkIns[s.userAssignmentId] ? (
                          <>
                            <Undo2 className="w-4 h-4 mr-1" /> Desfazer
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-4 h-4 mr-1" /> Check-in
                          </>
                        )}
                      </Button>
                    ) : !s.isRecurring && s.userStatus === "pending" ? (
                      <>
                        <Button size="sm" className="flex-1" onClick={() => confirmAssignment(s.userAssignmentId)}>
                          <Check className="w-4 h-4 mr-1" /> Confirmar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                          onClick={() => markUnavailable(s.userAssignmentId)}
                        >
                          <X className="w-4 h-4 mr-1" /> Recusar
                        </Button>
                      </>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      className={canCheckIn(s) || (!s.isRecurring && s.userStatus === "pending") ? "flex-1" : "w-full"}
                      onClick={() => {
                        setSelected(s);
                        setShowDetail(true);
                      }}
                    >
                      Detalhes <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              ))}
            </section>
          ) : (
            <div className="text-center py-12 border-2 border-dashed rounded-3xl">
              <p className="text-muted-foreground text-sm">Nenhuma escala futura encontrada.</p>
            </div>
          )}
        </div>

        <ScheduleDetailDialog
          schedule={selected}
          open={showDetail}
          onOpenChange={setShowDetail}
          onConfirm={(id) => {
            confirmAssignment(id);
            refetch();
          }}
          onUnavailable={(id) => {
            markUnavailable(id);
            refetch();
          }}
          isAdmin={false}
          onRefresh={refetch}
          sameEventUserIds={[]}
        />
      </AppLayout>
    </ProtectedRoute>
  );
};

export default Schedules;
