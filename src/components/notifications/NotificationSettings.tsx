import { Bell, BellOff, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";

export function NotificationSettings() {
  const { permission, requestPermission } = useNotifications();

  const getIcon = () => {
    switch (permission) {
      case "granted":
        return <BellRing className="w-5 h-5 text-green-500" />;
      case "denied":
        return <BellOff className="w-5 h-5 text-destructive" />;
      default:
        return <Bell className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    switch (permission) {
      case "granted":
        return "Notificações ativadas";
      case "denied":
        return "Notificações bloqueadas";
      default:
        return "Notificações desativadas";
    }
  };

  const getButtonText = () => {
    switch (permission) {
      case "granted":
        return "Ativadas";
      case "denied":
        return "Bloqueadas no navegador";
      default:
        return "Ativar notificações";
    }
  };

  return (
    <div className="sirvo-card flex items-center gap-3 sm:gap-4">
      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground text-sm sm:text-base">Notificações Push</p>
        <p className="text-xs sm:text-sm text-muted-foreground truncate">{getStatusText()}</p>
      </div>
      <Button
        variant={permission === "granted" ? "outline" : "default"}
        size="sm"
        onClick={requestPermission}
        disabled={permission === "denied"}
        className="shrink-0 text-xs sm:text-sm whitespace-nowrap"
      >
        {getButtonText()}
      </Button>
    </div>
  );
}