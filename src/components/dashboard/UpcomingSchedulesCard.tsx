import { useState, useEffect } from "react";
import { Calendar, Clock, Check, ArrowLeftRight, Loader2, ChevronRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useChurchId } from "@/hooks/useChurchId";
import { format, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UpcomingItem {
  assignmentId: string;
  scheduleId: string;
  ministryId: string;
  title: string;
  eventDate: string;
  startTime: string;
  ministry: string;
  ministryColor: string;
  userRole?: string;
  status: string | null;
}

export function UpcomingSchedulesCard() {
  const { toast } = useToast();
  const { churchId } = useChurchId();
  const [items, setItems] = useState<UpcomingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [swapTarget, setSwapTarget] = useState<UpcomingItem | null>(null);
  const [availableUsers, setAvailableUsers] = useState<{ id: string; name: string }[]>([]);
  const [swapping, setSwapping] = useState(false);

  useEffect(() => {
    fetchUpcoming();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [churchId]);

  const fetchUpcoming = async () => {
    if (!churchId) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("schedule_assignments")
        .select(`
          id,
          status,
          schedule_id,
          ministry_roles:role_id (name),
          schedules!inner (
            id,
            ministry_id,
            events!inner ( title, event_date, start_time ),
            ministries!inner ( name, color, church_id )
          )
        `)
        .eq("user_id", user.id)
        .limit(50);

      if (error) throw error;

      const list: UpcomingItem[] = (data || [])
        .filter((a: any) => a.schedules?.events?.event_date >= today)
        .map((a: any) => ({
          assignmentId: a.id,
          scheduleId: a.schedule_id,
          ministryId: a.schedules.ministry_id,
          title: a.schedules.events.title,
          eventDate: a.schedules.events.event_date,
          startTime: a.schedules.events.start_time?.slice(0, 5) || "",
          ministry: a.schedules.ministries.name,
          ministryColor: a.schedules.ministries.color || "#5B7BFF",
          userRole: a.ministry_roles?.name,
          status: a.status,
        }))
        .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
        .slice(0, 5);

      setItems(list);
    } catch (err) {
      console.error("Error fetching upcoming schedules:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (item: UpcomingItem) => {
    setActingId(item.assignmentId);
    try {
      const { error } = await supabase
        .from("schedule_assignments")
        .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
        .eq("id", item.assignmentId);

      if (error) throw error;

      toast({ title: "Escala confirmada ✓", description: "Você verá esta data no seu calendário." });
      fetchUpcoming();
    } catch (err: any) {
      toast({ title: "Erro ao confirmar", description: err.message, variant: "destructive" });
    } finally {
      setActingId(null);
    }
  };

  const openSwap = async (item: UpcomingItem) => {
    setSwapTarget(item);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: members } = await supabase
        .from("ministry_members")
        .select(`user_id, profiles:user_id (full_name)`)
        .eq("ministry_id", item.ministryId)
        .neq("user_id", user.id);

      // Exclude users already in the schedule
      const { data: assigned } = await supabase
        .from("schedule_assignments")
        .select("user_id")
        .eq("schedule_id", item.scheduleId);

      const assignedIds = new Set((assigned || []).map((a: any) => a.user_id));

      const available = (members || [])
        .filter((m: any) => !assignedIds.has(m.user_id))
        .map((m: any) => ({
          id: m.user_id,
          name: m.profiles?.full_name || "Sem nome",
        }));

      setAvailableUsers(available);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const requestSwap = async (targetUserId: string, targetName: string) => {
    if (!swapTarget) return;
    setSwapping(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error: updateError } = await supabase
        .from("schedule_assignments")
        .update({
          status: "pending_swap",
          notes: `Solicitou troca com ${targetName}`,
        })
        .eq("id", swapTarget.assignmentId);

      if (updateError) throw updateError;

      // Create swap request entry so it appears in /trocas
      await supabase.from("swap_requests").insert({
        schedule_id: swapTarget.scheduleId,
        requester_id: user.id,
        requested_id: targetUserId,
        requester_assignment_id: swapTarget.assignmentId,
        status: "pending",
      });

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      const dateLabel = format(new Date(swapTarget.eventDate), "dd/MM", { locale: ptBR });

      await supabase.rpc("send_notification", {
        _user_id: targetUserId,
        _title: "Solicitação de Troca",
        _message: `${profile?.full_name || "Um voluntário"} pediu para trocar a escala de ${dateLabel}`,
        _type: "swap_request",
        _related_schedule_id: swapTarget.scheduleId,
      });

      toast({
        title: "Solicitação enviada",
        description: `${targetName} foi notificado. A escala fica em "Trocas" até confirmação.`,
      });

      setSwapTarget(null);
      setAvailableUsers([]);
      fetchUpcoming();
    } catch (err: any) {
      toast({ title: "Erro ao solicitar troca", description: err.message, variant: "destructive" });
    } finally {
      setSwapping(false);
    }
  };

  const formatDateLabel = (iso: string) => {
    const d = new Date(iso + "T12:00:00");
    if (isToday(d)) return "Hoje";
    if (isTomorrow(d)) return "Amanhã";
    return format(d, "EEE, d 'de' MMM", { locale: ptBR });
  };

  const statusBadge = (status: string | null) => {
    if (status === "confirmed")
      return (
        <Badge className="bg-success/15 text-success hover:bg-success/15 border-0 text-[10px] gap-1 font-bold uppercase tracking-wide">
          <CheckCircle2 className="w-2.5 h-2.5" />
          Confirmado
        </Badge>
      );
    if (status === "pending_swap")
      return (
        <Badge className="bg-accent/15 text-accent hover:bg-accent/15 border-0 text-[10px] font-bold uppercase tracking-wide">
          Em troca
        </Badge>
      );
    return (
      <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-0 text-[10px] font-bold uppercase tracking-wide">
        Aguarda confirmação
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="sirvo-card-lavender">
        <div className="h-32 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="sirvo-card-lavender animate-slide-up">
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 mx-auto text-primary/40 mb-3" />
          <p className="text-foreground font-semibold">Nenhuma escala próxima</p>
          <p className="text-xs text-muted-foreground mt-1">
            Você será notificado quando for escalado
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="sirvo-card-lavender animate-slide-up p-4 sm:p-5">
        <div className="space-y-0">
          {items.map((item, index) => {
            const isPendingSwap = item.status === "pending_swap";
            const isConfirmed = item.status === "confirmed";
            const isLast = index === items.length - 1;

            return (
              <div
                key={item.assignmentId}
                className={`relative pl-12 sm:pl-14 ${isLast ? "pb-1" : "pb-5"}`}
              >
                {/* Timeline vertical line */}
                {!isLast && (
                  <div className="absolute left-[34px] sm:left-[42px] top-8 bottom-0 w-px bg-foreground/20" />
                )}

                {/* Time / date pill */}
                <div className="absolute left-0 top-0 text-right w-9 sm:w-11">
                  <p className="text-[10px] sm:text-xs font-black uppercase text-foreground leading-tight">
                    {item.startTime || "—"}
                  </p>
                  <p className="text-[9px] sm:text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                    {format(new Date(item.eventDate + "T12:00:00"), "d MMM", { locale: ptBR })}
                  </p>
                </div>

                {/* Pink dot on timeline */}
                <div className="absolute left-[28px] sm:left-[36px] top-1.5 w-3 h-3 rounded-full bg-accent ring-4 ring-sirvo-lavender-soft" />

                {/* Content */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm sm:text-base font-black uppercase text-foreground truncate">
                        {item.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate font-medium">
                        <span style={{ color: item.ministryColor }}>●</span>{" "}
                        {item.ministry} • {item.userRole || "Voluntário"}
                      </p>
                    </div>
                    {statusBadge(item.status)}
                  </div>

                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1 capitalize font-semibold text-foreground/70">
                      <Calendar className="w-3 h-3" />
                      {formatDateLabel(item.eventDate)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {item.startTime}
                    </span>
                  </div>

                  {!isPendingSwap && (
                    <div className="flex gap-2 mt-3">
                      {!isConfirmed && (
                        <Button
                          size="sm"
                          className="h-8 text-[11px] flex-1 gap-1 bg-success hover:bg-success/90 text-success-foreground rounded-full font-bold uppercase tracking-wide"
                          onClick={() => handleConfirm(item)}
                          disabled={actingId === item.assignmentId}
                        >
                          {actingId === item.assignmentId ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          Confirmar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-[11px] flex-1 gap-1 rounded-full border-primary/30 text-primary hover:bg-primary/5 font-bold uppercase tracking-wide"
                        onClick={() => openSwap(item)}
                      >
                        <ArrowLeftRight className="w-3 h-3" />
                        Trocar
                      </Button>
                    </div>
                  )}

                  {isPendingSwap && (
                    <p className="text-[11px] text-accent mt-2 flex items-center gap-1 font-semibold">
                      <ChevronRight className="w-3 h-3" />
                      Acompanhe o pedido em "Trocas"
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Swap dialog */}
      <Dialog
        open={!!swapTarget}
        onOpenChange={(open) => {
          if (!open) {
            setSwapTarget(null);
            setAvailableUsers([]);
          }
        }}
      >
        <DialogContent className="max-w-md mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-primary" />
              Solicitar troca
            </DialogTitle>
            <DialogDescription>
              {swapTarget && (
                <>
                  Escolha quem você quer chamar para a escala de{" "}
                  <strong>{formatDateLabel(swapTarget.eventDate)}</strong> às{" "}
                  {swapTarget.startTime}.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {availableUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum voluntário disponível neste ministério.
              </p>
            ) : (
              availableUsers.map((u) => (
                <Button
                  key={u.id}
                  variant="outline"
                  className="w-full justify-start gap-3 h-auto py-3"
                  onClick={() => requestSwap(u.id, u.name)}
                  disabled={swapping}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-bold text-primary-foreground">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium">{u.name}</span>
                  {swapping && <Loader2 className="w-4 h-4 animate-spin ml-auto" />}
                </Button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
