import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";
import { isSuperAdminEmail } from "@/lib/superadmin";

export type AppRole = "admin" | "ministry_leader" | "volunteer";

const rank: Record<AppRole, number> = { admin: 3, ministry_leader: 2, volunteer: 1 };

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLeader, setIsLeader] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUserRole() {
      if (!user) {
        setRole(null);
        setIsAdmin(false);
        setIsLeader(false);
        setIsSuperAdmin(false);
        setLoading(false);
        return;
      }

      // Superadmin bypass
      if (isSuperAdminEmail(user.email)) {
        setRole("admin");
        setIsAdmin(true);
        setIsLeader(false);
        setIsSuperAdmin(true);
        setLoading(false);
        return;
      }

      try {
        // church_members is the source of truth for the role inside the church
        const { data: memberships } = await supabase
          .from("church_members")
          .select("role")
          .eq("user_id", user.id);

        let resolved: AppRole | null = null;
        for (const m of memberships || []) {
          const r = (m.role || "volunteer") as AppRole;
          if (!resolved || rank[r] > rank[resolved]) resolved = r;
        }

        if (!resolved) {
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id);
          for (const r of roles || []) {
            const rr = (r.role || "volunteer") as AppRole;
            if (!resolved || rank[rr] > rank[resolved]) resolved = rr;
          }
        }

        const finalRole: AppRole = resolved || "volunteer";
        setRole(finalRole);
        setIsAdmin(finalRole === "admin");
        setIsLeader(finalRole === "ministry_leader");
      } catch (err) {
        console.error("Error fetching user role:", err);
        setRole("volunteer");
        setIsAdmin(false);
        setIsLeader(false);
      } finally {
        setLoading(false);
      }
    }

    fetchUserRole();
  }, [user]);

  return {
    role,
    isAdmin,
    isLeader,
    isSuperAdmin,
    /** admin, super admin or ministry leader */
    canManage: isAdmin || isSuperAdmin || isLeader,
    loading,
  };
}
