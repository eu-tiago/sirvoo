import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  role: string;
  churchName?: string;
}

export function useUserProfile() {
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

        // Fetch role
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        // Fetch church
        const { data: memberData } = await supabase
          .from("church_members")
          .select("churches (name)")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

        setProfile({
          id: user.id,
          fullName: profileData?.full_name || user.email?.split("@")[0] || "Usuário",
          email: profileData?.email || user.email || "",
          avatarUrl: profileData?.avatar_url,
          role: roleData?.role || "volunteer",
          churchName: (memberData as any)?.churches?.name,
        });
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  return { profile, loading };
}
