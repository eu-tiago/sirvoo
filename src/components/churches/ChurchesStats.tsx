import { Card, CardContent } from "@/components/ui/card";
import { Church, Users, MapPin } from "lucide-react";

interface ChurchesStatsProps {
  stats: {
    total: number;
    totalMembers: number;
    cities: number;
  };
}

export function ChurchesStats({ stats }: ChurchesStatsProps) {
  const statItems = [
    {
      label: "Total de Igrejas",
      value: stats.total,
      icon: Church,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: "Total de Membros",
      value: stats.totalMembers,
      icon: Users,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100",
    },
    {
      label: "Cidades",
      value: stats.cities,
      icon: MapPin,
      color: "text-amber-600",
      bgColor: "bg-amber-100",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-4">
      {statItems.map((item) => (
        <Card key={item.label}>
          <CardContent className="flex items-center gap-2 sm:gap-4 p-3 sm:p-4">
            <div className={`w-9 h-9 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl ${item.bgColor} flex items-center justify-center shrink-0`}>
              <item.icon className={`w-4 h-4 sm:w-6 sm:h-6 ${item.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-lg sm:text-2xl font-bold text-foreground">{item.value}</p>
              <p className="text-[10px] sm:text-sm text-muted-foreground truncate">{item.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
