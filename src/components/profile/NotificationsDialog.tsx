import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, Calendar, UserPlus, AlertCircle, Loader2, Check, Trash2, ArrowLeftRight, X, CheckCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PushNotificationToggle } from "@/components/notifications/PushNotificationToggle";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  related_schedule_id: string | null;
}

interface NotificationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const iconMap: Record<string, React.ElementType> = {
  schedule: Calendar,
  invite: UserPlus,
  reminder: Bell,
  alert: AlertCircle,
  info: Bell,
  swap_request: ArrowLeftRight,
};

const colorMap: Record<string, string> = {
  schedule: "bg-primary/10 text-primary",
  invite: "bg-green-100 text-green-600",
  reminder: "bg-amber-100 text-amber-600",
  alert: "bg-red-100 text-red-600",
  info: "bg-blue-100 text-blue-600",
  swap_request: "bg-purple-100 text-purple-600",
};

export function NotificationsDialog({ open, onOpenChange }: NotificationsDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (open && user) {
      fetchNotifications();
    }
  }, [open, user]);

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (error) throw error;

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      
      toast({
        title: "Notificações marcadas como lidas",
      });
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (error) {
      console.error("Error deleting notification:", error);
      toast({
        title: "Erro ao excluir",
        description: "Tente novamente",
        variant: "destructive",
      });
    }
  };

  const handleSwapResponse = async (notification: Notification, accept: boolean) => {
    if (!notification.related_schedule_id || !user) return;

    try {
      // Find the assignment with pending_swap status for this schedule
      const { data: pendingAssignment, error: fetchError } = await supabase
        .from("schedule_assignments")
        .select("id, user_id, status, notes")
        .eq("schedule_id", notification.related_schedule_id)
        .eq("status", "pending_swap")
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!pendingAssignment) {
        toast({
          title: "Solicitação não encontrada",
          description: "Esta solicitação já foi processada ou cancelada.",
          variant: "destructive",
        });
        await deleteNotification(notification.id);
        return;
      }

      // Get the requester's name
      const { data: requesterProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", pendingAssignment.user_id)
        .maybeSingle();

      if (accept) {
        // Swap the users: update the pending assignment to have the current user
        const { error: updateError } = await supabase
          .from("schedule_assignments")
          .update({ 
            user_id: user.id, 
            status: "confirmed",
            confirmed_at: new Date().toISOString(),
            notes: `Troca aceita de ${requesterProfile?.full_name || "voluntário"}`
          })
          .eq("id", pendingAssignment.id);

        if (updateError) throw updateError;

        // Notify the original user that swap was accepted
        await supabase.rpc("send_notification", {
          _user_id: pendingAssignment.user_id,
          _title: "Troca Aceita!",
          _message: `Sua solicitação de troca foi aceita.`,
          _type: "info",
          _related_schedule_id: notification.related_schedule_id
        });

        toast({
          title: "Troca aceita!",
          description: "Você assumiu esta escala.",
        });
      } else {
        // Reject: revert the assignment status back to pending
        const { error: updateError } = await supabase
          .from("schedule_assignments")
          .update({ 
            status: "pending",
            notes: null
          })
          .eq("id", pendingAssignment.id);

        if (updateError) throw updateError;

        // Notify the original user that swap was rejected
        await supabase.rpc("send_notification", {
          _user_id: pendingAssignment.user_id,
          _title: "Troca Recusada",
          _message: `Sua solicitação de troca foi recusada.`,
          _type: "alert",
          _related_schedule_id: notification.related_schedule_id
        });

        toast({
          title: "Troca recusada",
          description: "A solicitação foi recusada.",
        });
      }

      // Delete the notification after processing
      await deleteNotification(notification.id);
    } catch (error: any) {
      console.error("Error handling swap response:", error);
      toast({
        title: "Erro ao processar",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Notificações</DialogTitle>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                <Check className="w-4 h-4 mr-1" />
                Marcar todas como lidas
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Push Notifications Toggle */}
        <div className="py-3 px-1">
          <PushNotificationToggle />
        </div>
        <Separator />

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhuma notificação</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => {
              const Icon = iconMap[notification.type] || Bell;
              const color = colorMap[notification.type] || colorMap.info;

              return (
                <div
                  key={notification.id}
                  className={`p-4 rounded-xl border transition-all ${
                    !notification.is_read
                      ? "bg-primary/5 border-primary/20"
                      : "bg-muted/30 border-border/50"
                  }`}
                  onClick={() => !notification.is_read && markAsRead(notification.id)}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm text-foreground">
                          {notification.title}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 w-8 h-8 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {notification.message}
                      </p>
                      
                      {/* Swap request action buttons */}
                      {notification.type === "swap_request" && notification.related_schedule_id && (
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSwapResponse(notification, true);
                            }}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Aceitar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSwapResponse(notification, false);
                            }}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Recusar
                          </Button>
                        </div>
                      )}
                      
                      <p className="text-xs text-muted-foreground/70 mt-2">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}