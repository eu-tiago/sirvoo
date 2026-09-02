import { Card } from "@/components/ui/card";
import { CalendarClock } from "lucide-react";

export function RehearsalsTab() {
  return (
    <Card className="p-8 text-center space-y-2">
      <CalendarClock className="w-8 h-8 mx-auto text-muted-foreground" />
      <p className="font-semibold">Ensaios</p>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Agenda de ensaios com lista de presença e repertório vinculado chega na próxima entrega deste módulo.
      </p>
    </Card>
  );
}
