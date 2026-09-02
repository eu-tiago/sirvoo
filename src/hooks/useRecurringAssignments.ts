import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface RecurringAssignment {
  id: string;
  church_id: string;
  ministry_id: string;
  user_id: string;
  role_id: string | null;
  weekday: number;
  occurrence: number;
  time: string | null; // ARQUITETURA: Nova propriedade de horário
  start_date: string | null;
  end_date: string | null;
  active: boolean;
  /** derivados */
  userName?: string;
  ministryName?: string;
  ministryColor?: string;
  roleName?: string;
}

export interface RecurringInput {
  id?: string;
  ministry_id: string;
  user_id: string;
  role_id: string | null;
  weekday: number;
  occurrence: number;
  time: string | null; // ARQUITETURA: Nova entrada de horário
  start_date: string | null;
  end_date: string | null;
  active?: boolean;
}

export function useRecurringAssignments(churchId: string | null) {
  const { toast } = useToast();
  const [items, setItems] = useState<RecurringAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    if (!churchId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("recurring_assignments")
        .select("*")
        .eq("church_id", churchId)
        .order("weekday", { ascending: true })
        .order("time", { ascending: true }) // Ordena pelo horário também
        .order("occurrence", { ascending: true });
      if (error) throw error;

      const rows = (data || []) as any[];
      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
      const roleIds = Array.from(new Set(rows.map((r) => r.role_id).filter(Boolean)));
      const ministryIds = Array.from(new Set(rows.map((r) => r.ministry_id)));

      const [profilesRes, rolesRes, ministriesRes] = await Promise.all([
        userIds.length
          ? (supabase as any).from("safe_profiles").select("id, full_name").in("id", userIds)
          : Promise.resolve({ data: [] }),
        roleIds.length
          ? supabase
              .from("ministry_roles")
              .select("id, name")
              .in("id", roleIds as string[])
          : Promise.resolve({ data: [] }),
        ministryIds.length
          ? supabase.from("ministries").select("id, name, color").in("id", ministryIds)
          : Promise.resolve({ data: [] }),
      ]);

      const nameById = new Map((profilesRes.data || []).map((p: any) => [p.id, p.full_name]));
      const roleById = new Map((rolesRes.data || []).map((r: any) => [r.id, r.name]));
      const ministryById = new Map((ministriesRes.data || []).map((m: any) => [m.id, m]));

      setItems(
        rows.map((r) => ({
          ...r,
          userName: nameById.get(r.user_id) || "Sem nome",
          roleName: r.role_id ? roleById.get(r.role_id) : undefined,
          ministryName: ministryById.get(r.ministry_id)?.name || "",
          ministryColor: ministryById.get(r.ministry_id)?.color || "#5B7BFF",
        })),
      );
    } catch (error: any) {
      console.error("Error fetching recurring assignments:", error);
      toast({
        title: "Erro ao carregar escalas fixas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [churchId, toast]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const save = async (input: RecurringInput) => {
    if (!churchId) return false;
    setSaving(true);
    try {
      const payload = {
        church_id: churchId,
        ministry_id: input.ministry_id,
        user_id: input.user_id,
        role_id: input.role_id,
        weekday: input.weekday,
        occurrence: input.occurrence,
        time: input.time, // Adicionando o horário no envio para o banco
        start_date: input.start_date,
        end_date: input.end_date,
        active: input.active ?? true,
      };

      if (input.id) {
        const { error } = await supabase.from("recurring_assignments").update(payload).eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("recurring_assignments").insert(payload);
        if (error) {
          // duplicidade -> atualiza o registro equivalente existente
          if ((error as any).code === "23505") {
            const existing = items.find(
              (i) =>
                i.ministry_id === payload.ministry_id &&
                i.user_id === payload.user_id &&
                (i.role_id || null) === (payload.role_id || null) &&
                i.weekday === payload.weekday &&
                i.occurrence === payload.occurrence &&
                (i.time || null) === (payload.time || null), // Valida se é no mesmo horário
            );
            if (existing) {
              const { error: upErr } = await supabase
                .from("recurring_assignments")
                .update(payload)
                .eq("id", existing.id);
              if (upErr) throw upErr;
              toast({
                title: "Escala fixa atualizada",
                description: "Já existia uma escala igual — ela foi atualizada.",
              });
              await fetch();
              return true;
            }
          }
          throw error;
        }
      }

      toast({ title: input.id ? "Escala fixa atualizada" : "Escala fixa criada" });
      await fetch();
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao salvar escala fixa",
        description: error.message,
        variant: "destructive",
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      const { error } = await supabase.from("recurring_assignments").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Escala fixa removida" });
      await fetch();
    } catch (error: any) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    try {
      const { error } = await supabase.from("recurring_assignments").update({ active }).eq("id", id);
      if (error) throw error;
      await fetch();
    } catch (error: any) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    }
  };

  /** Aplica as escalas fixas às escalas já existentes de um período */
  const syncRange = async (from: string, to: string) => {
    if (!churchId) return 0;
    try {
      const { data, error } = await supabase.rpc("sync_recurring_for_range", {
        _church_id: churchId,
        _from: from,
        _to: to,
      });
      if (error) throw error;
      const count = (data as number) || 0;
      toast({
        title: "Sincronização concluída",
        description:
          count > 0
            ? `${count} escalação(ões) criada(s) a partir das escalas fixas.`
            : "Nenhuma nova escalação necessária.",
      });
      return count;
    } catch (error: any) {
      toast({
        title: "Erro ao sincronizar",
        description: error.message,
        variant: "destructive",
      });
      return 0;
    }
  };

  return { items, loading, saving, refetch: fetch, save, remove, toggleActive, syncRange };
}
