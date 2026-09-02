import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface SwapRequest {
  id: string;
  schedule_id: string;
  requester_id: string;
  requester_assignment_id: string;
  requested_id: string;
  status: string;
  created_at: string;
  requester_name: string;
  schedule_title: string;
  schedule_date: string;
  ministry_name: string;
  /** true = sent directly to this user; false = ministry-wide */
  isDirect: boolean;
}

export function useSwapRequests() {
  const { toast } = useToast();
  const [directRequests, setDirectRequests] = useState<SwapRequest[]>([]);
  const [ministryRequests, setMinistryRequests] = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Direct requests – where user is the requested person
      const { data: directData } = await supabase
        .from("swap_requests")
        .select("*")
        .eq("requested_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      // 2. Get user's ministry IDs
      const { data: myMinistries } = await supabase
        .from("ministry_members")
        .select("ministry_id")
        .eq("user_id", user.id);

      const ministryIds = (myMinistries || []).map((m) => m.ministry_id);

      // 3. Ministry requests – pending swaps in user's ministries but NOT directed to user
      let ministryData: any[] = [];
      if (ministryIds.length > 0) {
        // Get schedules in user's ministries
        const { data: schedules } = await supabase
          .from("schedules")
          .select("id")
          .in("ministry_id", ministryIds);

        const scheduleIds = (schedules || []).map((s) => s.id);

        if (scheduleIds.length > 0) {
          const { data } = await supabase
            .from("swap_requests")
            .select("*")
            .in("schedule_id", scheduleIds)
            .eq("status", "pending")
            .neq("requested_id", user.id)
            .neq("requester_id", user.id)
            .order("created_at", { ascending: false });

          ministryData = data || [];
        }
      }

      // Enrich helper
      const enrich = async (reqs: any[], isDirect: boolean): Promise<SwapRequest[]> => {
        const enriched: SwapRequest[] = [];
        for (const req of reqs) {
          const { data: profile } = await supabase
            .from("safe_profiles")
            .select("full_name")
            .eq("id", req.requester_id)
            .maybeSingle();

          const { data: schedule } = await supabase
            .from("schedules")
            .select("id, event_id, ministry_id")
            .eq("id", req.schedule_id)
            .maybeSingle();

          let eventTitle = "Escala";
          let eventDate = "";
          let ministryName = "";

          if (schedule) {
            const { data: event } = await supabase
              .from("events")
              .select("title, event_date")
              .eq("id", schedule.event_id)
              .maybeSingle();

            const { data: ministry } = await supabase
              .from("ministries")
              .select("name")
              .eq("id", schedule.ministry_id)
              .maybeSingle();

            eventTitle = event?.title || "Escala";
            eventDate = event?.event_date || "";
            ministryName = ministry?.name || "";
          }

          enriched.push({
            id: req.id,
            schedule_id: req.schedule_id,
            requester_id: req.requester_id,
            requester_assignment_id: req.requester_assignment_id,
            requested_id: req.requested_id,
            status: req.status,
            created_at: req.created_at,
            requester_name: profile?.full_name || "Sem nome",
            schedule_title: eventTitle,
            schedule_date: eventDate,
            ministry_name: ministryName,
            isDirect,
          });
        }
        return enriched;
      };

      const [enrichedDirect, enrichedMinistry] = await Promise.all([
        enrich(directData || [], true),
        enrich(ministryData, false),
      ]);

      setDirectRequests(enrichedDirect);
      setMinistryRequests(enrichedMinistry);
    } catch (error: any) {
      console.error("Error fetching swap requests:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const acceptSwap = async (request: SwapRequest) => {
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { error: assignError } = await supabase
        .from("schedule_assignments")
        .update({
          user_id: user.id,
          status: "confirmed",
          notes: `Aceitou troca com ${request.requester_name}`,
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", request.requester_assignment_id);

      if (assignError) throw assignError;

      const { error: swapError } = await supabase
        .from("swap_requests")
        .update({ status: "accepted", updated_at: new Date().toISOString() })
        .eq("id", request.id);

      if (swapError) throw swapError;

      await supabase.rpc("send_notification", {
        _user_id: request.requester_id,
        _title: "Troca Aceita!",
        _message: `Sua solicitação de troca para "${request.schedule_title}" foi aceita.`,
        _type: "swap_accepted",
        _related_schedule_id: request.schedule_id,
      });

      toast({
        title: "Troca aceita!",
        description: `Você aceitou a troca para "${request.schedule_title}".`,
      });

      fetchRequests();
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao aceitar troca",
        description: error.message,
        variant: "destructive",
      });
      return false;
    } finally {
      setProcessing(false);
    }
  };

  const rejectSwap = async (request: SwapRequest) => {
    setProcessing(true);
    try {
      const { error: swapError } = await supabase
        .from("swap_requests")
        .update({ status: "rejected", updated_at: new Date().toISOString() })
        .eq("id", request.id);

      if (swapError) throw swapError;

      await supabase
        .from("schedule_assignments")
        .update({ status: "pending", notes: null })
        .eq("id", request.requester_assignment_id);

      await supabase.rpc("send_notification", {
        _user_id: request.requester_id,
        _title: "Troca Recusada",
        _message: `Sua solicitação de troca para "${request.schedule_title}" foi recusada.`,
        _type: "swap_rejected",
        _related_schedule_id: request.schedule_id,
      });

      toast({
        title: "Troca recusada",
        description: "A solicitação foi recusada.",
      });

      fetchRequests();
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao recusar troca",
        description: error.message,
        variant: "destructive",
      });
      return false;
    } finally {
      setProcessing(false);
    }
  };

  return {
    directRequests,
    ministryRequests,
    requests: [...directRequests, ...ministryRequests],
    loading,
    processing,
    acceptSwap,
    rejectSwap,
    refetch: fetchRequests,
  };
}
