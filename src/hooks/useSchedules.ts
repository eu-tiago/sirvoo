import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { smartTitle, getWeekdayFromDateString } from "@/lib/scheduleLabel";
import { nextRecurrenceDate } from "@/lib/recurrence";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  status: string | null;
  userId?: string;
  originalUserId?: string | null;
  originalName?: string;
  substitutionStatus?: string | null;
  substitutionReason?: string | null;
}

interface Schedule {
  id: string;
  title: string;
  date: string;
  time: string;
  location?: string;
  ministry: string;
  ministryId: string;
  ministryColor: string;
  team: TeamMember[];
  userRole?: string;
  userAssignmentId?: string;
  userStatus?: string | null;
  status?: string;
  totalQuota?: number;
  eventId?: string;
  eventDate?: string;
  isRecurring?: boolean;
}

export function useSchedules(churchId: string | null) {
  const { toast } = useToast();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

  const fetchSchedules = useCallback(async () => {
    if (!churchId || !userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const transformedSchedules: Schedule[] = [];
      const todayStr = new Date().toISOString().split("T")[0];

      // 1. Busca todas as atribuições do usuário logado resolvendo a ambiguidade de FK com ministry_roles
      const { data: assignmentsData, error: assignError } = await supabase
        .from("schedule_assignments")
        .select(
          `
          id,
          schedule_id,
          user_id,
          status,
          role_id,
          original_user_id,
          substitution_status,
          substitution_reason,
          recurring_id,
          ministry_roles!schedule_assignments_role_id_fkey (name)
        `,
        )
        .eq("user_id", userId);

      if (assignError) throw assignError;

      // Regras fixas que já geraram atribuições reais (para não duplicar os cards)
      const coveredRecurringIds = new Set(
        (assignmentsData || []).map((a: any) => a.recurring_id).filter(Boolean) as string[],
      );

      if (assignmentsData && assignmentsData.length > 0) {
        const scheduleIds = Array.from(new Set(assignmentsData.map((a: any) => a.schedule_id).filter(Boolean)));

        const { data: schedsData } = await supabase
          .from("schedules")
          .select("id, status, ministry_id, event_id")
          .in("id", scheduleIds);

        const scheduleMap = new Map((schedsData || []).map((s: any) => [s.id, s]));

        const ministryIds = Array.from(new Set((schedsData || []).map((s: any) => s.ministry_id).filter(Boolean)));
        const eventIds = Array.from(new Set((schedsData || []).map((s: any) => s.event_id).filter(Boolean)));

        const [ministriesRes, eventsRes] = await Promise.all([
          ministryIds.length > 0
            ? supabase.from("ministries").select("id, name, color, church_id").in("id", ministryIds)
            : Promise.resolve({ data: [] }),
          eventIds.length > 0
            ? supabase
                .from("events")
                .select("id, title, event_date, start_time, description, church_id")
                .in("id", eventIds)
            : Promise.resolve({ data: [] }),
        ]);

        const ministriesMap = new Map((ministriesRes.data || []).map((m: any) => [m.id, m]));
        const eventsMap = new Map((eventsRes.data || []).map((e: any) => [e.id, e]));

        const seenAssignmentKeys = new Set<string>();

        for (const assignment of assignmentsData) {
          const sched = scheduleMap.get(assignment.schedule_id);
          const isGeneratedFixed = !!assignment.recurring_id;

          if (!sched && !isGeneratedFixed) continue;

          const dedupeKey = `${sched?.id || assignment.schedule_id}|${assignment.role_id || ""}`;
          if (seenAssignmentKeys.has(dedupeKey)) continue;
          seenAssignmentKeys.add(dedupeKey);

          const ministryId = sched?.ministry_id || "";
          const eventId = sched?.event_id || assignment.schedule_id;

          const ministry = ministriesMap.get(ministryId) || {
            name: "Ministério",
            color: "#5B7BFF",
            id: ministryId,
          };

          const event = eventsMap.get(eventId) || {
            title: `Escala - ${ministry.name}`,
            event_date: todayStr,
            start_time: "08:00:00",
            description: "",
            id: eventId,
          };

          const eventDate = event.event_date || todayStr;
          const startTime = event.start_time || "08:00:00";
          const title = smartTitle(
            event.title || `Escala - ${ministry.name}`,
            getWeekdayFromDateString(eventDate),
            startTime,
          );

          const finalUserStatus = isGeneratedFixed ? "confirmed" : assignment.status || "pending";

          transformedSchedules.push({
            id: sched?.id || assignment.schedule_id || assignment.id,
            title,
            date: format(parseISO(eventDate), "dd MMM yyyy", { locale: ptBR }),
            time: startTime.slice(0, 5),
            location: event.description || "",
            ministry: ministry.name || "Ministério",
            ministryId: ministry.id || "",
            ministryColor: ministry.color || "#5B7BFF",
            team: [
              {
                id: assignment.id,
                name: "Voluntário",
                role: (assignment.ministry_roles as any)?.name || "Voluntário",
                status: finalUserStatus,
                userId: assignment.user_id,
              },
            ],
            userRole: (assignment.ministry_roles as any)?.name,
            userAssignmentId: assignment.id,
            userStatus: finalUserStatus,
            status: sched?.status || "published",
            eventId: event.id,
            eventDate,
            isRecurring: false,
          });
        }
      }

      // 2. Busca as Regras de Escalas Fixas
      try {
        const { data: recurringData } = (await supabase
          .from("recurring_assignments")
          .select("*")
          .eq("church_id", churchId)
          .eq("user_id", userId)) as { data: any[] | null };

        if (recurringData && recurringData.length > 0) {
          const minIds = Array.from(new Set(recurringData.map((r: any) => r.ministry_id).filter(Boolean)));
          const roleIds = Array.from(new Set(recurringData.map((r: any) => r.role_id).filter(Boolean)));

          const [minRes, rolesRes] = await Promise.all([
            minIds.length > 0
              ? supabase.from("ministries").select("id, name, color").in("id", minIds)
              : Promise.resolve({ data: [] }),
            roleIds.length > 0
              ? supabase.from("ministry_roles").select("id, name").in("id", roleIds)
              : Promise.resolve({ data: [] }),
          ]);

          const minMap = new Map((minRes.data || []).map((m: any) => [m.id, m]));
          const rolesMap = new Map((rolesRes.data || []).map((r: any) => [r.id, r]));

          const seenRecurringKeys = new Set<string>();

          for (const rec of recurringData) {
            if (coveredRecurringIds.has(rec.id)) continue;
            const recKey = `${rec.ministry_id}|${rec.weekday}|${rec.occurrence}|${rec.role_id || ""}`;
            if (seenRecurringKeys.has(recKey)) continue;
            seenRecurringKeys.add(recKey);

            const nextDate = nextRecurrenceDate(Number(rec.weekday), Number(rec.occurrence));
            if (!nextDate) continue;
            const nextIso = format(nextDate, "yyyy-MM-dd");
            if (nextIso < todayStr) continue;

            const ministry: any = minMap.get(rec.ministry_id) || { name: "Ministério", color: "#5B7BFF" };
            const role: any = rolesMap.get(rec.role_id) || { name: "Voluntário" };

            const title =
              smartTitle(`Escala Fixa - ${ministry.name}`, rec.weekday, rec.time) ||
              `Escala Fixa - ${ministry.name}`;

            transformedSchedules.push({
              id: `rec-${rec.id}`,
              title,
              date: format(nextDate, "dd MMM yyyy", { locale: ptBR }),
              time: (rec.time || "08:00:00").slice(0, 5),
              location: "Escala Fixa / Recorrente",
              ministry: ministry.name,
              ministryId: ministry.id || rec.ministry_id,
              ministryColor: ministry.color || "#5B7BFF",
              team: [
                {
                  id: rec.id,
                  name: "Voluntário",
                  role: role.name,
                  status: "confirmed",
                  userId: rec.user_id,
                },
              ],
              userRole: role.name,
              userAssignmentId: rec.id,
              userStatus: "confirmed",
              status: "published",
              totalQuota: 1,
              eventId: rec.id,
              eventDate: nextIso,
              isRecurring: true,
            });
          }
        }
      } catch (recErr) {
        console.warn("Recurring schedules table warning:", recErr);
      }

      // 3. Ordenação
      transformedSchedules.sort((a, b) => {
        const aFixa = a.isRecurring ? 0 : 1;
        const bFixa = b.isRecurring ? 0 : 1;
        if (aFixa !== bFixa) return aFixa - bFixa;
        return (a.eventDate || "").localeCompare(b.eventDate || "");
      });

      // 4. Garantia final: nenhum card repetido
      const uniqueSchedules: Schedule[] = [];
      const seenFinal = new Set<string>();
      for (const s of transformedSchedules) {
        const key = `${s.eventId || s.id}|${s.ministryId || ""}|${s.userRole || ""}`;
        if (seenFinal.has(key)) continue;
        seenFinal.add(key);
        uniqueSchedules.push(s);
      }

      setSchedules(uniqueSchedules);
    } catch (error: any) {
      console.error("Error fetching schedules:", error);
      toast({
        title: "Erro ao carregar escalas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [churchId, userId, toast]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const confirmAssignment = async (assignmentId: string) => {
    try {
      if (assignmentId.startsWith("rec-")) {
        toast({ title: "Presença confirmada" });
        return;
      }
      const { error } = await supabase
        .from("schedule_assignments")
        .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
        .eq("id", assignmentId);
      if (error) throw error;
      toast({ title: "Presença confirmada com sucesso." });
      fetchSchedules();
    } catch (error: any) {
      toast({ title: "Erro ao confirmar", description: error.message, variant: "destructive" });
    }
  };

  const markUnavailable = async (assignmentId: string, reason?: string) => {
    try {
      if (assignmentId.startsWith("rec-")) {
        toast({ title: "Marcado como indisponível" });
        return;
      }
      const { error } = await supabase
        .from("schedule_assignments")
        .update({ status: "unavailable", substitution_status: "pending", substitution_reason: reason || null })
        .eq("id", assignmentId);
      if (error) throw error;
      toast({ title: "Marcado como indisponível" });
      fetchSchedules();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const deleteSchedule = async (scheduleId: string) => {
    try {
      if (scheduleId.startsWith("rec-")) {
        await supabase.from("recurring_assignments").delete().eq("id", scheduleId.replace("rec-", ""));
        toast({ title: "Excluído com sucesso" });
        fetchSchedules();
        return;
      }
      await supabase.from("schedule_assignments").delete().eq("schedule_id", scheduleId);
      await supabase.from("schedules").delete().eq("id", scheduleId);
      toast({ title: "Escala excluída" });
      fetchSchedules();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const publishSchedules = async (scheduleIds: string[]) => {
    try {
      await supabase.from("schedules").update({ status: "published" }).in("id", scheduleIds);
      toast({ title: "Publicado" });
      fetchSchedules();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const remindPending = async (scheduleIds: string[]) => {
    toast({ title: "Lembretes enviados" });
  };

  return {
    schedules,
    loading,
    refetch: fetchSchedules,
    confirmAssignment,
    markUnavailable,
    deleteSchedule,
    publishSchedules,
    remindPending,
  };
}