import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileStats } from "@/components/profile/ProfileStats";
import { ProfileMinistries } from "@/components/profile/ProfileMinistries";
import { AvailabilityDialog } from "@/components/profile/AvailabilityDialog";
import { ScheduleHistoryDialog } from "@/components/profile/ScheduleHistoryDialog";
import { NotificationSettings } from "@/components/notifications/NotificationSettings";
import { ReminderSettings } from "@/components/profile/ReminderSettings";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, ChevronRight, LogOut, HelpCircle, FileText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const Profile = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [avatarUrl, setAvatarUrl] = useState<string>();
  const [churchName, setChurchName] = useState("Carregando...");
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    if (!user) return;

    try {
      // Fetch profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.avatar_url) {
        setAvatarUrl(profile.avatar_url);
      }

      // Fetch church name
      const { data: membership } = await supabase
        .from("church_members")
        .select("church:churches(name)")
        .eq("user_id", user.id)
        .maybeSingle();

      if (membership?.church) {
        setChurchName((membership.church as any).name);
      } else {
        setChurchName("Sem igreja vinculada");
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      setChurchName("Erro ao carregar");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário";
  const userEmail = user?.email || "";

  const menuItems = [
    { 
      icon: Calendar, 
      label: "Minha Disponibilidade", 
      onClick: () => setAvailabilityOpen(true) 
    },
    { 
      icon: Clock, 
      label: "Histórico de Escalas", 
      onClick: () => setHistoryOpen(true) 
    },
    { 
      icon: FileText, 
      label: "Termos e Políticas", 
      onClick: () => navigate("/termos") 
    },
    { 
      icon: HelpCircle, 
      label: "Ajuda e Suporte", 
      onClick: () => navigate("/ajuda") 
    },
  ];

  return (
    <ProtectedRoute>
      <AppLayout>
        <ProfileHeader
          name={userName}
          email={userEmail}
          avatarUrl={avatarUrl}
          church={churchName}
          onAvatarUpdate={setAvatarUrl}
        />
        
        <ProfileStats />

        <ProfileMinistries />

        {/* Notification Settings */}
        <div className="px-4 md:px-6 mt-6">
          <h2 className="text-lg font-bold text-foreground mb-4">Configurações</h2>
          <NotificationSettings />
          <div className="mt-3">
            <ReminderSettings />
          </div>
        </div>

        {/* Menu */}
        <div className="px-4 md:px-6 mt-6">
          <div className="space-y-2">
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={item.onClick}
                className="w-full sirvo-card flex items-center gap-4 hover:shadow-sirvo transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <span className="flex-1 text-left font-medium text-foreground">
                  {item.label}
                </span>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>

        {/* Logout */}
        <div className="px-4 md:px-6 mt-6 pb-24 md:pb-6">
          <Button 
            variant="outline" 
            className="w-full text-destructive border-destructive/20 hover:bg-destructive/5"
            onClick={handleSignOut}
          >
            <LogOut className="w-5 h-5 mr-2" />
            Sair da conta
          </Button>
        </div>

        {/* Dialogs */}
        <AvailabilityDialog open={availabilityOpen} onOpenChange={setAvailabilityOpen} />
        <ScheduleHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} />
      </AppLayout>
    </ProtectedRoute>
  );
};

export default Profile;