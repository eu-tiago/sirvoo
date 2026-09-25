import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { useChurch } from "./ChurchContext";
import { supabase } from "@/integrations/supabase/client";
export type AppRole = "admin" | "ministry_leader" | "volunteer";
export function useUserRole() {
  const { user, loading: authLoading } = useAuth();
  const { church, loading: churchLoading } = useChurch();
  const master = useQuery({
    queryKey: ["platform-admin", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_super_admin");
      if (error) throw error;
      return data === true;
    },
  });
  const isSuperAdmin = !!user && master.data === true;
  const role: AppRole | null = isSuperAdmin ? "admin" : church?.role ?? null;
  const isAdmin = role === "admin";
  const isLeader = role === "ministry_leader";
  return { role, isAdmin, isLeader, isSuperAdmin, canManage: isAdmin || isLeader,
    loading: authLoading || churchLoading || master.isLoading };
}
