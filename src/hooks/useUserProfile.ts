import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useChurch } from "./ChurchContext";
import { useUserRole } from "./useUserRole";
import { useAuth } from "./useAuth";

interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  role: string;
  churchName?: string;
}

export function useUserProfile() {
  const { church } = useChurch();
  const { role } = useUserRole();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        // Fetch profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name, email, avatar_url")
          .eq("id", user.id)
          .maybeSingle();

        setProfile({
          id: user.id,
          fullName: profileData?.full_name || user.email?.split("@")[0] || "Usuário",
          email: profileData?.email || user.email || "",
          avatarUrl: profileData?.avatar_url,
          role: role || "volunteer",
          churchName: church?.name,
        });
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [currentUser?.id, role, church?.name]);

  return { profile: currentUser?.id === profile?.id ? profile : null, loading };
}
