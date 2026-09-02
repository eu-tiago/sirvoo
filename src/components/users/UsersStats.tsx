import { Users, ShieldCheck, Shield, UserCheck } from "lucide-react";

interface UsersStatsProps {
  total: number;
  admins: number;
  leaders: number;
  volunteers: number;
}

export function UsersStats({ total, admins, leaders, volunteers }: UsersStatsProps) {
  const stats = [
    {
      label: "Total",
      value: total,
      icon: Users,
      color: "bg-primary/10 text-primary",
    },
    {
      label: "Admins",
      value: admins,
      icon: ShieldCheck,
      color: "bg-emerald-100 text-emerald-600",
    },
    {
      label: "Líderes",
      value: leaders,
      icon: Shield,
      color: "bg-amber-100 text-amber-600",
    },
    {
      label: "Voluntários",
      value: volunteers,
      icon: UserCheck,
      color: "bg-secondary/30 text-secondary-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="sirvo-card flex items-center gap-2 md:gap-4 animate-fade-in p-3 md:p-4"
        >
          <div
            className={`w-9 h-9 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}
          >
            <stat.icon className="w-4 h-4 md:w-6 md:h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-lg md:text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="text-xs md:text-sm text-muted-foreground truncate">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
