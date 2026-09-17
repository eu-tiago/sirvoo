import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [checkingChurch, setCheckingChurch] = useState(true);
  const [hasChurch, setHasChurch] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }

    const checkChurch = async () => {
      if (!user) {
        setCheckingChurch(false);
        return;
      }

      try {
        const { data: membership } = await supabase
          .from("church_members")
          .select("church_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

        const { data: profile } = await supabase
          .from("profiles")
          .select("must_change_password")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.must_change_password) {
          setMustChangePassword(true);
          navigate("/change-password", { replace: true });
          return;
        }

        if (membership) {
          setHasChurch(true);
        } else {
          // User has no church, redirect to onboarding
          navigate("/onboarding");
        }
      } catch (error) {
        console.error("Error checking church:", error);
      } finally {
        setCheckingChurch(false);
      }
    };

    if (user && !loading) {
      checkChurch();
    }
  }, [user, loading, navigate]);

  if (loading || checkingChurch) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !hasChurch || mustChangePassword) {
    return null;
  }

  return <>{children}</>;
}
