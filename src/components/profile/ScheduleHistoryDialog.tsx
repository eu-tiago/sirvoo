import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface ScheduleHistory {
  id: string;
  status: string;
  confirmed_at: string | null;
  schedule: {
    id: string;
    event: {
      title: string;
      event_date: string;
      start_time: string;
    };
    ministry: {
      name: string;
      color: string;
    };
  };
  role?: {
    name: string;
  };
}

interface ScheduleHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScheduleHistoryDialog({ open, onOpenChange }: ScheduleHistoryDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<ScheduleHistory[]>([]);

  useEffect(() => {
    if (open && user) {
      fetchHistory();
    }
  }, [open, user]);

  const fetchHistory = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("schedule_assignments")
        .select(`
          id,
          status,
          confirmed_at,
          role:ministry_roles(name),
          schedule:schedules(
            id,
            event:events(title, event_date, start_time),
            ministry:ministries(name, color)
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Transform data
      const transformed = (data || [])
        .filter((item: any) => item.schedule?.event && item.schedule?.ministry)
        .map((item: any) => ({
          id: item.id,
          status: item.status,
          confirmed_at: item.confirmed_at,
          schedule: {
            id: item.schedule.id,
            event: item.schedule.event,
            ministry: item.schedule.ministry,
          },
          role: item.role,
        }));

      setHistory(transformed);
    } catch (error) {
      console.error("Error fetching schedule history:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return (
          <Badge className="bg-green-100 text-green-700 border-green-200">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Confirmado
          </Badge>
        );
      case "declined":
        return (
          <Badge className="bg-red-100 text-red-700 border-red-200">
            <XCircle className="w-3 h-3 mr-1" />
            Recusado
          </Badge>
        );
      default:
        return (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200">
            <Clock className="w-3 h-3 mr-1" />
            Pendente
          </Badge>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Histórico de Escalas</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhum histórico encontrado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <div
                key={item.id}
                className="p-4 bg-muted/30 rounded-xl border border-border/50"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-foreground">
                      {item.schedule.event.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: item.schedule.ministry.color || "#5B7BFF" }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {item.schedule.ministry.name}
                      </span>
                      {item.role && (
                        <>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground">
                            {item.role.name}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {getStatusBadge(item.status)}
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>
                    {format(new Date(item.schedule.event.event_date), "dd/MM/yyyy", {
                      locale: ptBR,
                    })}
                  </span>
                  <span>{item.schedule.event.start_time.slice(0, 5)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}