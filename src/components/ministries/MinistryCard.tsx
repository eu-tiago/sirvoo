import { Users, ChevronRight } from "lucide-react";

interface MinistryCardProps {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  color: string;
  icon: React.ElementType;
  userRole?: string;
}

export function MinistryCard({
  id,
  name,
  description,
  memberCount,
  color,
  icon: Icon,
  userRole,
}: MinistryCardProps) {
  return (
    <div className="sirvo-card group hover:shadow-sirvo-lg transition-all duration-300 cursor-pointer">
      <div className="flex items-start gap-4">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${color}15`, color }}
        >
          <Icon className="w-7 h-7" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-foreground text-lg">{name}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {description}
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-300 shrink-0" />
          </div>

          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>{memberCount} membros</span>
            </div>
            {userRole && (
              <span
                className="text-xs font-medium px-2 py-1 rounded-full"
                style={{ backgroundColor: `${color}15`, color }}
              >
                {userRole}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
