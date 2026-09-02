import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AvailabilityManager } from "@/components/profile/AvailabilityManager";
import { CalendarOff } from "lucide-react";

const Availability = () => {
  return (
    <ProtectedRoute>
      <AppLayout>
        <header className="px-4 md:px-6 pt-6 md:pt-8 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <CalendarOff className="w-6 h-6 text-primary" />
            <h1 className="text-xl md:text-2xl font-bold text-foreground">
              Minhas Disponibilidades
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Informe as datas em que você não poderá servir. Os líderes verão essas datas ao montar
            as escalas.
          </p>
        </header>

        <div className="px-4 md:px-6 pb-28 md:pb-8 max-w-2xl">
          <AvailabilityManager />
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
};

export default Availability;
