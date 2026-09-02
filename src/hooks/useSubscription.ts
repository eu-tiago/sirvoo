import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type SubscriptionPlan = "free" | "basic" | "standard";

interface SubscriptionStatus {
  subscribed: boolean;
  plan: SubscriptionPlan;
  max_users: number;
  subscription_end?: string;
}

export function useSubscription() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);

  const checkSubscription = useCallback(async (churchId?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription", {
        body: { churchId },
      });

      if (error) throw error;

      setSubscription(data);
      return data as SubscriptionStatus;
    } catch (error: any) {
      console.error("Error checking subscription:", error);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const createCheckout = useCallback(async (plan: "basic" | "standard", churchId: string) => {
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
      const { data, error } = await supabase.functions.invoke("customer-portal");

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
  }, [toast]);

  return {
    subscription,
    loading,
    maxUsers: subscription?.max_users ?? 3,
    isSuperAdmin: false, // Will be overridden by consumers checking useUserRole
    checkSubscription,
    createCheckout,
    openCustomerPortal,
  };
}
