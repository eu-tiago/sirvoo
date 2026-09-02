import { useState, useEffect } from "react";
import { Calendar, Clock, Music, Users, Check, Eye, ArrowLeftRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useChurchId } from "@/hooks/useChurchId";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  status: string | null;
  userId: string;
}

interface NextSchedule {
  id: string;
  title: string;
  date: string;
  time: string;
  ministry: string;
  ministryColor: string;
  userRole?: string;
  userAssignmentId?: string;
  userStatus?: string | null;
  team: TeamMember[];
}

export function NextScheduleCard() {
  const { toast } = useToast();
  const { churchId } = useChurchId();
  const [schedule, setSchedule] = useState<NextSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showSwapDialog, setShowSwapDialog] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<{ id: string; name: string }[]>([]);
  const [swapping, setSwapping] = useState(false);

  useEffect(() => {
    fetchNextSchedule();
  }, [churchId]);

  const fetchNextSchedule = async () => {
    if (!churchId) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get next schedule where user is assigned
      const today = new Date().toISOString().split('T')[0];
      
      const { data: assignments, error } = await supabase
        .from("schedule_assignments")
        .select(`
          id,
          status,
          user_id,
          schedule_id,
          ministry_roles:role_id (name),
          schedules!inner (
            id,
            ministry_id,
            events!inner (
              title,
              event_date,
              start_time
            ),
            ministries!inner (
              name,
              color,
              church_id
            )
          )
        `)
        .eq("user_id", user.id)
        .gte("schedules.events.event_date", today)
        .order("created_at", { ascending: true })
        .limit(10);

      if (error) throw error;

      if (assignments && assignments.length > 0) {
        // Sort by event_date client-side since nested ordering isn't supported
        const sorted = [...assignments].sort((a: any, b: any) => {
          const dateA = a.schedules?.events?.event_date || '';
          const dateB = b.schedules?.events?.event_date || '';
          return dateA.localeCompare(dateB);
        });
        const assignment = sorted[0] as any;
        const event = assignment.schedules.events;
        const ministry = assignment.schedules.ministries;

        // Fetch all team members for this schedule
        const { data: teamData } = await supabase
          .from("schedule_assignments")
          .select(`
            id,
            status,
            user_id,
            profiles:user_id (full_name),
            ministry_roles:role_id (name)
          `)
          .eq("schedule_id", assignment.schedule_id);

        const team: TeamMember[] = (teamData || []).map((t: any) => ({
          id: t.id,
          name: t.profiles?.full_name || "Sem nome",
          role: t.ministry_roles?.name || "Voluntário",
          status: t.status,
          userId: t.user_id
        }));

        setSchedule({
          id: assignment.schedule_id,
          title: event.title,
          date: format(new Date(event.event_date), "EEEE, d MMM", { locale: ptBR }),
          time: event.start_time?.slice(0, 5) || "",
          ministry: ministry.name,
          ministryColor: ministry.color || "#5B7BFF",
          userRole: assignment.ministry_roles?.name,
          userAssignmentId: assignment.id,
          userStatus: assignment.status,
          team
        });
      } else {
        setSchedule(null);
      }
    } catch (error: any) {
      console.error("Error fetching next schedule:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!schedule?.userAssignmentId) return;
    
    setConfirming(true);
    try {
      const { error } = await supabase
        .from("schedule_assignments")
        .update({ 
          status: "confirmed", 
          confirmed_at: new Date().toISOString() 
        })
        .eq("id", schedule.userAssignmentId);

      if (error) throw error;

      toast({
        title: "Presença confirmada!",
        description: "Você confirmou sua participação na escala.",
      });

      fetchNextSchedule();
    } catch (error: any) {
      toast({
        title: "Erro ao confirmar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setConfirming(false);
    }
  };

  const handleSwapRequest = async () => {
    if (!schedule) return;

    try {
      // Fetch available ministry members (excluding current user)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get the ministry_id from the schedule
      const { data: scheduleData } = await supabase
        .from("schedules")
        .select("ministry_id")
        .eq("id", schedule.id)
        .single();

      if (!scheduleData) {
        throw new Error("Escala não encontrada");
      }

      const { data: ministryMembers, error } = await supabase
        .from("ministry_members")
        .select(`
          user_id,
          profiles:user_id (full_name)
        `)
        .eq("ministry_id", scheduleData.ministry_id)
        .neq("user_id", user.id);

      if (error) throw error;

      // Filter out users already in the team
      const teamUserIds = schedule.team.map(t => t.userId);
      const available = (ministryMembers || [])
        .filter((m: any) => !teamUserIds.includes(m.user_id))
        .map((m: any) => ({
          id: m.user_id,
          name: m.profiles?.full_name || "Sem nome"
        }));

      setAvailableUsers(available);
      setShowSwapDialog(true);
    } catch (error: any) {
      toast({
        title: "Erro ao buscar usuários",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const requestSwap = async (targetUserId: string, targetUserName: string) => {
    if (!schedule?.userAssignmentId) return;
    
    setSwapping(true);
    try {
      // Update assignment status to pending_swap
      const { error: updateError } = await supabase
        .from("schedule_assignments")
        .update({ status: "pending_swap", notes: `Solicitou troca com ${targetUserName}` })
        .eq("id", schedule.userAssignmentId);

      if (updateError) throw updateError;

      // Send notification to target user
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user?.id)
        .single();

      await supabase.rpc("send_notification", {
        _user_id: targetUserId,
        _title: "Solicitação de Troca",
        _message: `${profile?.full_name || "Um voluntário"} solicitou trocar de escala com você para ${schedule.date}`,
        _type: "swap_request",
        _related_schedule_id: schedule.id
      });

      toast({
        title: "Solicitação enviada!",
        description: `Solicitação de troca enviada para ${targetUserName}.`,
      });

      setShowSwapDialog(false);
      fetchNextSchedule();
    } catch (error: any) {
      toast({
        title: "Erro ao solicitar troca",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSwapping(false);
    }
  };

  if (loading) {
    return (
      <div className="sirvo-card-gradient animate-pulse">
        <div className="h-40 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="sirvo-card-gradient animate-slide-up">
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhuma escala próxima</p>
          <p className="text-xs text-muted-foreground mt-1">Você será notificado quando for escalado</p>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "confirmed":
        return <Badge className="bg-green-500/10 text-green-600 text-xs">Confirmado</Badge>;
      case "pending_swap":
        return <Badge className="bg-amber-500/10 text-amber-600 text-xs">Troca Pendente</Badge>;
      case "unavailable":
        return <Badge className="bg-destructive/10 text-destructive text-xs">Indisponível</Badge>;
      default:
        return <Badge className="bg-primary/10 text-primary text-xs">Pendente</Badge>;
    }
  };

  return (
    <>
      <div className="sirvo-card-gradient animate-slide-up">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-primary uppercase tracking-wide mb-1">
              Próxima Escala
            </p>
            <h3 className="text-lg sm:text-xl font-bold text-foreground truncate">
              {schedule.userRole || "Voluntário"}
            </h3>
            <div className="mt-1">
              {getStatusBadge(schedule.userStatus)}
            </div>
          </div>
          <div 
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shadow-sirvo shrink-0"
            style={{ background: `linear-gradient(135deg, ${schedule.ministryColor}, hsl(188, 72%, 70%))` }}
          >
            <Music className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
        </div>

        <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Calendar className="w-4 h-4 shrink-0" />
            <span className="text-xs sm:text-sm font-medium capitalize">{schedule.date}</span>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <Clock className="w-4 h-4 shrink-0" />
            <span className="text-xs sm:text-sm font-medium">{schedule.time}</span>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <Users className="w-4 h-4 shrink-0" />
            <span className="text-xs sm:text-sm font-medium">{schedule.ministry}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4 sm:mb-6">
          <span className="text-xs text-muted-foreground shrink-0">Equipe:</span>
          <div className="flex -space-x-2 overflow-hidden">
            {schedule.team.slice(0, 4).map((member, i) => (
              <div
                key={member.id}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-bold text-primary-foreground border-2 border-card"
                title={member.name}
              >
                {member.name.charAt(0)}
              </div>
            ))}
            {schedule.team.length > 4 && (
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground border-2 border-card">
                +{schedule.team.length - 4}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          {schedule.userStatus !== "confirmed" && (
            <Button 
              variant="default" 
              className="flex-1 gap-2"
              onClick={handleConfirm}
              disabled={confirming}
            >
              {confirming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span className="text-sm">Confirmar</span>
            </Button>
          )}
          <Button 
            variant="outline" 
            className="flex-1 gap-2"
            onClick={() => setShowDetails(true)}
          >
            <Eye className="w-4 h-4" />
            <span className="text-sm">Detalhes</span>
          </Button>
          <Button 
            variant="outline" 
            className="flex-1 gap-2"
            onClick={handleSwapRequest}
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span className="text-sm">Trocar</span>
          </Button>
        </div>
      </div>

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-md mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Music className="w-5 h-5 text-primary" />
              {schedule.title}
            </DialogTitle>
            <DialogDescription>
              Detalhes da escala
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
              <Calendar className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium capitalize">{schedule.date}</p>
                <p className="text-xs text-muted-foreground">{schedule.time}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
              <Users className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium">{schedule.ministry}</p>
                <p className="text-xs text-muted-foreground">Função: {schedule.userRole || "Voluntário"}</p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Equipe ({schedule.team.length})</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {schedule.team.map((member) => (
                  <div 
                    key={member.id} 
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-bold text-primary-foreground">
                        {member.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.role}</p>
                      </div>
                    </div>
                    {getStatusBadge(member.status)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Swap Dialog */}
      <Dialog open={showSwapDialog} onOpenChange={setShowSwapDialog}>
        <DialogContent className="max-w-md mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-primary" />
              Solicitar Troca
            </DialogTitle>
            <DialogDescription>
              Selecione um voluntário para trocar sua escala
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {availableUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum voluntário disponível para troca
              </p>
            ) : (
              availableUsers.map((user) => (
                <Button
                  key={user.id}
                  variant="outline"
                  className="w-full justify-start gap-3 h-auto py-3"
                  onClick={() => requestSwap(user.id, user.name)}
                  disabled={swapping}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-bold text-primary-foreground">
                    {user.name.charAt(0)}
                  </div>
                  <span className="text-sm font-medium">{user.name}</span>
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
