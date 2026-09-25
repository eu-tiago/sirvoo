import { useChurchId } from "./useChurchId";
import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type SubscriptionPlan = "free" | "basic" | "standard" | "premium" | "unlimited";

interface SubscriptionStatus {
  subscribed: boolean;
  plan: SubscriptionPlan;
  max_users: number | null;
  is_unlimited: boolean;
  current_users: number;
  can_add_users: boolean;
  subscription_end?: string;
}

export function useSubscription() {
  const { toast } = useToast();
  const { churchId } = useChurchId();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const loadSubscription = async (id: string) => {
    const { data, error } = await supabase.rpc("get_church_subscription", { _church_id: id });
    if (error) throw error;
    return data as unknown as SubscriptionStatus;
  };
  const query = useQuery({
    queryKey: ["church-subscription", user?.id, churchId], enabled: !!churchId && !!user,
    queryFn: () => loadSubscription(churchId!),
  });
  const subscription = query.data ?? null;
  const checkSubscription = useCallback(async (id = churchId) => {
    if (!id || !user) return null;
    return queryClient.fetchQuery({ queryKey: ["church-subscription", user.id, id], queryFn: () => loadSubscription(id), staleTime: 0 });
  }, [churchId, user, queryClient]);

  const createCheckout = useCallback(async (plan: Exclude<SubscriptionPlan, "free">, churchId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { plan, churchId },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error: any) {
      console.error("Error creating checkout:", error);
      toast({
        title: "Erro ao iniciar pagamento",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const openCustomerPortal = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal", { body: { churchId } });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error: any) {
      console.error("Error opening customer portal:", error);
      toast({
        title: "Erro ao abrir portal",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, churchId]);

  return {
    subscription,
    loading: loading || query.isLoading,
    ready: !!subscription && !query.isError,
    error: query.error,
    maxUsers: subscription?.is_unlimited ? Infinity : subscription?.max_users ?? 0,
    canAddUsers: !query.isError && subscription?.can_add_users === true,
    isSuperAdmin: false, // Will be overridden by consumers checking useUserRole
    checkSubscription,
    createCheckout,
    openCustomerPortal,
  };
}
