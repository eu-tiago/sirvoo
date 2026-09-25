import { createContext, useContext, ReactNode, useState, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface Church { id: string; name: string; role: "admin" | "ministry_leader" | "volunteer" }
const ChurchContext = createContext<{
  church: Church | null; loading: boolean;
  churches: { id: string; name: string }[]; selectChurch: (id: string) => void;
}>({ church: null, loading: true, churches: [], selectChurch: () => {} });
export function ChurchProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const master = useQuery({
    queryKey: ["platform-admin", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_super_admin");
      if (error) throw error;
      return data === true;
    },
  });
  const allChurches = useQuery({
    queryKey: ["master-churches", user?.id], enabled: !!user && master.data === true,
    queryFn: async () => {
      const { data, error } = await supabase.from("churches").select("id,name").order("name");
      if (error) throw error;
      return data;
    },
  });
  const query = useQuery({
    queryKey: ["current-church", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("church_members")
        .select("church_id, role, churches(name)").eq("user_id", user!.id)
        .order("joined_at").order("church_id").limit(1).maybeSingle();
      if (error) throw error;
      return data ? { id: data.church_id, name: data.churches?.name ?? "", role: data.role } : null;
    },
  });
  const choices = master.data === true ? allChurches.data ?? [] : [];
  const active = choices.find(c => c.id === selected) ?? choices.find(c => c.id === query.data?.id) ?? choices[0];
  const church: Church | null = !user ? null : master.data === true && active
    ? { ...active, role: "admin" } : query.data ?? null;
  return <ChurchContext.Provider value={{
    church, churches: choices, selectChurch: setSelected,
    loading: loading || query.isLoading || master.isLoading || allChurches.isLoading,
  }}><Fragment key={`${user?.id}:${church?.id}`}>{children}</Fragment></ChurchContext.Provider>;
}
export function useChurch() { return useContext(ChurchContext); }
