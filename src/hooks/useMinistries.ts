import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MinistryMember {
  id: string;
  userId: string;
  name: string;
  email?: string;
  isLeader: boolean;
  roles: { id: string; name: string }[];
}

interface MinistryRole {
  id: string;
  name: string;
  description?: string;
}

interface Ministry {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  memberCount: number;
  members?: MinistryMember[];
  roles?: MinistryRole[];
}

export function useMinistries(churchId: string | null) {
  const { toast } = useToast();
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMinistries = useCallback(async () => {
    if (!churchId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ministries")
        .select(`
          id,
          name,
          description,
          color,
          icon,
          ministry_members (
            id,
            user_id,
            is_leader
          ),
          ministry_roles (
            id,
            name,
            description
          )
        `)
        .eq("church_id", churchId)
        .order("name");

      if (error) throw error;

      // Fetch profiles separately for each member
      const memberUserIds = (data || []).flatMap(m => 
        m.ministry_members?.map((mm: any) => mm.user_id) || []
      );

      const { data: profiles } = await supabase
        .from("safe_profiles")
        .select("id, full_name, email")
        .in("id", memberUserIds);

      if (error) throw error;

      const profilesMap = new Map(
        (profiles || []).map(p => [p.id, p])
      );

      const transformedMinistries: Ministry[] = (data || []).map((m: any) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        color: m.color || "#5B7BFF",
        icon: m.icon || "music",
        memberCount: m.ministry_members?.length || 0,
        members: m.ministry_members?.map((mm: any) => {
          const profile = profilesMap.get(mm.user_id);
          return {
            id: mm.id,
            userId: mm.user_id,
            name: profile?.full_name || "Sem nome",
            email: profile?.email,
            isLeader: mm.is_leader || false,
            roles: [],
          };
        }),
        roles: m.ministry_roles?.map((r: any) => ({
          id: r.id,
          name: r.name,
          description: r.description,
        })),
      }));

      setMinistries(transformedMinistries);
    } catch (error: any) {
      console.error("Error fetching ministries:", error);
      toast({
        title: "Erro ao carregar ministérios",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [churchId, toast]);

  useEffect(() => {
    fetchMinistries();
  }, [fetchMinistries]);

  const createMinistry = async (data: {
    name: string;
    description?: string;
    color: string;
    icon: string;
  }) => {
    if (!churchId) return;

    try {
      const { error } = await supabase.from("ministries").insert({
        ...data,
        church_id: churchId,
      });

      if (error) throw error;

      toast({ title: "Ministério criado com sucesso" });
      fetchMinistries();
    } catch (error: any) {
      toast({
        title: "Erro ao criar ministério",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateMinistry = async (
    id: string,
    data: { name: string; description?: string; color: string; icon: string }
  ) => {
    try {
      const { error } = await supabase
        .from("ministries")
        .update(data)
        .eq("id", id);

      if (error) throw error;

      toast({ title: "Ministério atualizado" });
      fetchMinistries();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteMinistry = async (id: string) => {
    try {
      const { error } = await supabase
        .from("ministries")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({ title: "Ministério excluído" });
      fetchMinistries();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const addMember = async (ministryId: string, userId: string, isLeader = false) => {
    try {
      const { error } = await supabase.from("ministry_members").insert({
        ministry_id: ministryId,
        user_id: userId,
        is_leader: isLeader,
      });

      if (error) throw error;

      toast({ title: "Membro adicionado" });
      fetchMinistries();
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar membro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from("ministry_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;

      toast({ title: "Membro removido" });
      fetchMinistries();
    } catch (error: any) {
      toast({
        title: "Erro ao remover membro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateMemberLeader = async (memberId: string, isLeader: boolean) => {
    try {
      const { error } = await supabase
        .from("ministry_members")
        .update({ is_leader: isLeader })
        .eq("id", memberId);

      if (error) throw error;

      toast({ title: isLeader ? "Promovido a líder" : "Removido de líder" });
      fetchMinistries();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const addRole = async (ministryId: string, name: string, description?: string) => {
    console.log("useMinistries.addRole called:", { ministryId, name, description });
    try {
      const { data, error } = await supabase.from("ministry_roles").insert({
        ministry_id: ministryId,
        name,
        description,
      }).select();

      console.log("Insert result:", { data, error });

      if (error) throw error;

      toast({ title: "Função criada" });
      fetchMinistries();
    } catch (error: any) {
      console.error("Error adding role:", error);
      toast({
        title: "Erro ao criar função",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteRole = async (roleId: string) => {
    try {
      const { error } = await supabase
        .from("ministry_roles")
        .delete()
        .eq("id", roleId);

      if (error) throw error;

      toast({ title: "Função excluída" });
      fetchMinistries();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir função",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return {
    ministries,
    loading,
    refetch: fetchMinistries,
    createMinistry,
    updateMinistry,
    deleteMinistry,
    addMember,
    removeMember,
    updateMemberLeader,
    addRole,
    deleteRole,
  };
}
