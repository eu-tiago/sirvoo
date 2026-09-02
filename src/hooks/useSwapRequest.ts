import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AvailableUser {
  id: string;
  name: string;
}

export function useSwapRequest() {
  const { toast } = useToast();
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);

  const fetchAvailableUsers = async (scheduleId: string, ministryId: string) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: assignments } = await supabase
        .from("schedule_assignments")
        .select("user_id")
        .eq("schedule_id", scheduleId);

      const assignedUserIds = (assignments || []).map(a => a.user_id);

      const { data: ministryMembers, error } = await supabase
        .from("ministry_members")
        .select(`
          user_id,
          profiles:user_id (full_name)
        `)
        .eq("ministry_id", ministryId)
        .neq("user_id", user.id);

      if (error) throw error;

      const available = (ministryMembers || [])
        .filter((m: any) => !assignedUserIds.includes(m.user_id))
        .map((m: any) => ({
          id: m.user_id,
          name: m.profiles?.full_name || "Sem nome"
        }));

      setAvailableUsers(available);
      return available;
    } catch (error: any) {
      toast({
        title: "Erro ao buscar usuários",
        description: error.message,
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const requestSwap = async (
    assignmentId: string,
    scheduleId: string,
    targetUserId: string,
    targetUserName: string,
    scheduleInfo: string
  ) => {
    setSwapping(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Insert swap request into the new table
      const { error: insertError } = await supabase
        .from("swap_requests" as any)
        .insert({
          schedule_id: scheduleId,
          requester_id: user.id,
          requester_assignment_id: assignmentId,
          requested_id: targetUserId,
          status: "pending",
        });

      if (insertError) throw insertError;

      // Update assignment status
      const { error: updateError } = await supabase
        .from("schedule_assignments")
        .update({
          status: "pending_swap",
          notes: `Solicitou troca com ${targetUserName}`
        })
        .eq("id", assignmentId);

      if (updateError) throw updateError;

      // Get requester name for notification
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      // Notify the target user (in-app)
      await supabase.rpc("send_notification", {
        _user_id: targetUserId,
        _title: "Solicitação de Troca",
        _message: `${profile?.full_name || "Um voluntário"} solicitou trocar de escala com você para ${scheduleInfo}`,
        _type: "swap_request",
        _related_schedule_id: scheduleId
      });

      // Send push notification to the target user
      try {
        await supabase.functions.invoke("send-push-notification", {
          body: {
            userId: targetUserId,
            title: "Solicitação de Troca",
            body: `${profile?.full_name || "Um voluntário"} solicitou trocar de escala com você para ${scheduleInfo}`,
            data: { scheduleId, type: "swap_request" },
          },
        });
      } catch (pushErr) {
        console.warn("Push notification failed (non-blocking):", pushErr);
      }

      // Also notify other ministry members (team-wide visibility)
      try {
        const { data: schedule } = await supabase
          .from("schedules")
          .select("ministry_id")
          .eq("id", scheduleId)
          .maybeSingle();

        if (schedule?.ministry_id) {
          const { data: members } = await supabase
            .from("ministry_members")
            .select("user_id")
            .eq("ministry_id", schedule.ministry_id)
            .neq("user_id", user.id)
            .neq("user_id", targetUserId);

          const otherMemberIds = (members || []).map((m) => m.user_id);

          if (otherMemberIds.length > 0) {
            // In-app notifications for team
            for (const memberId of otherMemberIds) {
              await supabase.rpc("send_notification", {
                _user_id: memberId,
                _title: "Nova Solicitação de Troca",
                _message: `${profile?.full_name || "Um voluntário"} está buscando troca para a escala "${scheduleInfo}". Você pode aceitar!`,
                _type: "swap_request",
                _related_schedule_id: scheduleId,
              });
            }

            // Push notifications for team
            await supabase.functions.invoke("send-push-notification", {
              body: {
                userIds: otherMemberIds,
                title: "Nova Solicitação de Troca",
                body: `${profile?.full_name || "Um voluntário"} está buscando troca para "${scheduleInfo}". Você pode aceitar!`,
                data: { scheduleId, type: "swap_request" },
              },
            });
          }
        }
      } catch (teamErr) {
        console.warn("Team notification failed (non-blocking):", teamErr);
      }

      toast({
        title: "Solicitação enviada!",
        description: `Solicitação de troca enviada para ${targetUserName}.`,
      });

      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao solicitar troca",
        description: error.message,
        variant: "destructive",
      });
      return false;
    } finally {
      setSwapping(false);
    }
  };

  return {
    availableUsers,
    loading,
    swapping,
    fetchAvailableUsers,
    requestSwap,
    setAvailableUsers
  };
}
