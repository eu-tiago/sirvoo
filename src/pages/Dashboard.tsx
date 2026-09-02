import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { NotificationsList } from "@/components/dashboard/NotificationsList";
import { useDesktopNotifications } from "@/hooks/useDesktopNotifications";
import { Bell, Loader2, Repeat, Calendar, Clock, MapPin, Check, ChevronRight, X } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { TodayCheckInCard } from "@/components/dashboard/TodayCheckInCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSchedules } from "@/hooks/useSchedules";
import { useChurchId } from "@/hooks/useChurchId";
import { supabase } from "@/integrations/supabase/client";

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const { churchId } = useChurchId();
  const { schedules, confirmAssignment, markUnavailable } = useSchedules(churchId);
  const navigate = useNavigate();

  const [userName, setUserName] = useState<string>("Voluntário");

  useDesktopNotifications();

  // Busca o nome real do perfil do usuário para exibir no header
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;

      const metaName = user.user_metadata?.full_name || user.user_metadata?.name;
      if (metaName) {
        setUserName(metaName.split(" ")[0]);
        return;
      }

      try {
        const { data } = await supabase.from("safe_profiles").select("full_name").eq("id", user.id).maybeSingle();

        if (data?.full_name) {
          setUserName(data.full_name.split(" ")[0]);
        } else if (user.email) {
          setUserName(user.email.split("@")[0]);
        }
      } catch (err) {
        console.error("Erro ao buscar nome do usuário:", err);
      }
    };

    fetchUserProfile();
  }, [user]);

  // ORDENAÇÃO COM PRIORIDADE: Escala Fixa primeiro, depois por data
  const upcoming = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    return schedules
      .filter(
        (s) =>
          s.userAssignmentId &&
          s.status !== "draft" &&
          s.userStatus !== "unavailable" &&
          (!s.eventDate || s.eventDate >= todayStr),
      )
      .sort((a, b) => (a.eventDate || "").localeCompare(b.eventDate || ""));
  }, [schedules]);

  const listSchedules = upcoming.slice(0, 2);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <ProtectedRoute>
      <AppLayout showMobileHeader={false}>
        {/* HEADER CUSTOMIZADO */}
        <header className="relative bg-sirvo-navy-deep text-primary-foreground rounded-b-[2rem] overflow-hidden pt-[env(safe-area-inset-top)]">
          <div className="sirvo-blob-pink w-[150px] h-[150px] -top-10 -left-10 opacity-60" />
          <div className="sirvo-blob-green w-[120px] h-[120px] -top-5 -right-5 opacity-60" />

          <div className="relative px-6 pt-6 pb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] opacity-70">Olá,</p>
                <h1 className="font-display font-black text-3xl uppercase tracking-tight">{userName}</h1>
              </div>
              <button
                onClick={() => navigate("/profile")}
                className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-all"
              >
                <Bell className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* CONTEÚDO PRINCIPAL */}
        <div className="px-4 md:px-6 pt-4 pb-32 space-y-6">
          <TodayCheckInCard />

          {/* SEÇÃO DE MINHAS ESCALAS UNIFICADA (Fixa primeiro, depois Evento) */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold uppercase text-xs tracking-wider text-muted-foreground">Minhas Escalas</p>
              <Button variant="link" size="sm" className="text-xs h-auto p-0" onClick={() => navigate("/schedules")}>
                Ver todas
              </Button>
            </div>

            {listSchedules.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {listSchedules.map((s) => (
                  <div
                    key={s.id}
                    className="sirvo-card relative overflow-hidden shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
                      <Badge variant="secondary" className="gap-1 bg-muted/80 text-[10px]">
                        {s.isRecurring ? <Repeat className="w-3 h-3 text-primary" /> : <Calendar className="w-3 h-3" />}
                        {s.isRecurring ? "Escala Fixa" : "Evento"}
                      </Badge>
                      {s.userStatus === "confirmed" && (
                        <Badge className="gap-1 bg-green-500/10 text-green-600 border-green-500/20 text-[10px]">
                          <Check className="w-3 h-3" /> Confirmado
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-start gap-3 mb-3 pr-20">
                      <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0"
                        style={{
                          backgroundColor: (s.ministryColor || "#6366f1") + "20",
                          color: s.ministryColor || "#6366f1",
                        }}
                      >
                        {s.ministry ? s.ministry[0] : "E"}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-base truncate">{s.title}</h3>
                        <p className="text-xs text-muted-foreground truncate">
                          {s.ministry} {s.userRole ? `· ${s.userRole}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground mb-4">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" /> {s.date}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4" /> {s.time}
                      </span>
                      {s.location && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-4 h-4" /> {s.location}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-border">
                      {s.userStatus === "pending" ? (
                        <>
                          <Button size="sm" className="flex-1" onClick={() => confirmAssignment(s.userAssignmentId!)}>
                            <Check className="w-4 h-4 mr-1" /> Confirmar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                            onClick={() => markUnavailable(s.userAssignmentId!)}
                          >
                            <X className="w-4 h-4 mr-1" /> Recusar
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/schedules")}>
                          Detalhes <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="sirvo-card text-center py-8">
                <p className="text-muted-foreground text-sm">Você não possui escalas futuras no momento.</p>
              </div>
            )}
          </section>

          <section>
            <p className="font-bold uppercase text-xs tracking-wider text-muted-foreground mb-3">Estatísticas</p>
            <QuickStats />
          </section>

          <section>
            <p className="font-bold uppercase text-xs tracking-wider text-muted-foreground mb-3">Notificações</p>
            <NotificationsList />
          </section>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
};

export default Dashboard;
