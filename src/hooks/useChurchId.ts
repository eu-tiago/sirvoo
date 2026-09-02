import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useChurchId() {
  const [churchId, setChurchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChurchId = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const { data: membership } = await supabase
          .from("church_members")
          .select("church_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

        if (membership) {
          setChurchId(membership.church_id);
        }
      } catch (error) {
        console.error("Error fetching church:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchChurchId();
  }, []);

  return { churchId, loading };
}
