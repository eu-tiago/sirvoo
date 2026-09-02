import { useState, useEffect } from "react";
import { Bell, Clock, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function ReminderSettings() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (user) fetchSetting();
  }, [user]);

  const fetchSetting = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from("profiles")
        .select("reminders_enabled")
        .eq("id", user.id)
        .maybeSingle();
      if (data) setEnabled(data.reminders_enabled ?? true);
    } catch (e) {
      console.error("Error fetching reminder setting:", e);
    } finally {
      setLoading(false);
    }
  };

  const toggle = async (value: boolean) => {
    if (!user) return;
    setUpdating(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ reminders_enabled: value })
        .eq("id", user.id);
      if (error) throw error;
      setEnabled(value);
      toast.success(value ? "Lembretes ativados" : "Lembretes desativados");
    } catch (e) {
      console.error("Error updating reminder setting:", e);
      toast.error("Erro ao atualizar configuração");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="sirvo-card flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="sirvo-card">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center">
          <Clock className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground">Lembretes de Escala</p>
          <p className="text-sm text-muted-foreground">
            Receba notificações para lembrar suas escalas
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={toggle}
          disabled={updating}
        />
      </div>
      {enabled && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Bell className="w-3.5 h-3.5" />
            <span>2 dias antes · 1 dia antes · No dia do evento</span>
          </div>
        </div>
      )}
    </div>
  );
}
