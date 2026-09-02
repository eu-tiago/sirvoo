import { useState, useEffect } from "react";
import { Bell, Calendar, UserPlus, AlertCircle, ArrowLeftRight, Loader2, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

const iconMap: Record<string, React.ElementType> = {
  schedule: Calendar,
  invite: UserPlus,
  reminder: Bell,
  alert: AlertCircle,
  swap_request: ArrowLeftRight,
  info: Bell,
};

export function NotificationsList() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (user) fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications-list-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev].slice(0, 5));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);

      const { data, error } = await supabase
        .from("notifications")
        .select("*, schedules:related_schedule_id(events(event_date))")
        .eq("user_id", user.id)
        .gte("created_at", cutoff.toISOString())
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      const today = new Date().toISOString().split("T")[0];
      const filtered = (data || []).filter((n: any) => {
        const eventDate = n.schedules?.events?.event_date;
        if (!eventDate) return true;
        return eventDate >= today;
      });

      setNotifications(filtered.slice(0, 5));
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="text-center py-8 rounded-3xl bg-card border border-border/40">
        <Bell className="w-8 h-8 mx-auto mb-2 text-primary/30" />
        <p className="text-xs text-muted-foreground">Nenhuma notificação no momento</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {notifications.map((notification) => {
        const Icon = iconMap[notification.type] || FileText;
        const isCritical =
          notification.type === "alert" ||
          /vaga|indispon[ií]vel|recusou|abert/i.test(
            `${notification.title} ${notification.message}`,
          );
        const renderMessage = (msg: string) => {
          if (!isCritical) return msg;
          const parts = msg.split(/\s+em\s+/i);
          if (parts.length > 1) {
            return (
              <>
                {parts.slice(0, -1).join(" em ")} em{" "}
                <span className="font-bold text-foreground">{parts[parts.length - 1]}</span>
              </>
            );
          }
          return <span className="font-semibold text-foreground">{msg}</span>;
        };
        return (
          <div
            key={notification.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all cursor-pointer ${
              isCritical
                ? "bg-amber-50 dark:bg-amber-950/20 border-border/40 border-l-4 border-l-amber-500"
                : "bg-card border-border/40 hover:shadow-sirvo-soft"
            } ${!notification.is_read ? "ring-1 ring-primary/20" : ""}`}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isCritical ? "bg-amber-500/15" : "bg-primary/10"
              }`}
            >
              <Icon className={`w-4 h-4 ${isCritical ? "text-amber-600" : "text-primary"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-foreground truncate">
                {notification.title}
              </p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {renderMessage(notification.message)}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {formatDistanceToNow(new Date(notification.created_at), {
                  addSuffix: false,
                  locale: ptBR,
                })}
              </p>
              {!notification.is_read && (
                <div className="w-1.5 h-1.5 rounded-full bg-accent ml-auto mt-1" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
