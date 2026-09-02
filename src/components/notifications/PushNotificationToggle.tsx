import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { cn } from "@/lib/utils";

interface PushNotificationToggleProps {
  variant?: "button" | "switch";
  className?: string;
}

export function PushNotificationToggle({ 
  variant = "switch", 
  className 
}: PushNotificationToggleProps) {
  const { 
    isSupported, 
    isSubscribed, 
    permission, 
    loading, 
    toggleSubscription 
  } = usePushNotifications();

  if (!isSupported) {
    return null;
  }

  if (variant === "button") {
    return (
      <Button
        variant={isSubscribed ? "default" : "outline"}
        size="sm"
        onClick={toggleSubscription}
        disabled={loading || permission === "denied"}
        className={cn("gap-2", className)}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isSubscribed ? (
          <Bell className="w-4 h-4" />
        ) : (
          <BellOff className="w-4 h-4" />
        )}
        {isSubscribed ? "Notificações Ativas" : "Ativar Notificações"}
      </Button>
    );
  }

  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <div className="flex items-center gap-3">
        {isSubscribed ? (
          <Bell className="w-5 h-5 text-primary" />
        ) : (
          <BellOff className="w-5 h-5 text-muted-foreground" />
        )}
        <div>
          <p className="font-medium text-sm">Notificações Push</p>
          <p className="text-xs text-muted-foreground">
            {permission === "denied" 
              ? "Bloqueadas pelo navegador" 
              : isSubscribed 
                ? "Você receberá alertas" 
                : "Receba alertas de escalas"}
          </p>
        </div>
      </div>
      <Switch
        checked={isSubscribed}
        onCheckedChange={toggleSubscription}
        disabled={loading || permission === "denied"}
      />
    </div>
  );
}
