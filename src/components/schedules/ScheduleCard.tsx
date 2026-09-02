import { Calendar, Clock, MapPin, ChevronRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";


interface TeamMember {
  name: string;
  role: string;
  avatar?: string;
  confirmed: boolean | null;
}

interface ScheduleCardProps {
  title: string;
  date: string;
  time: string;
  location: string;
  ministry: string;
  ministryColor: string;
  team: TeamMember[];
  userRole?: string;
  confirmed?: boolean | null;
}

export function ScheduleCard({
  title,
  date,
  time,
  location,
  ministry,
  ministryColor,
  team,
  userRole,
  confirmed,
}: ScheduleCardProps) {
  return (
    <div className="sirvo-card group hover:shadow-sirvo-lg transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: ministryColor }}
            />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {ministry}
            </span>
          </div>
          <h3 className="text-lg font-bold text-foreground">{title}</h3>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-300" />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="w-4 h-4" />
          <span>{date}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>{time}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground col-span-2">
          <MapPin className="w-4 h-4" />
          <span>{location}</span>
        </div>
      </div>

      {userRole && (
        <div className="mb-4 p-3 rounded-xl bg-primary/5 border border-primary/10">
          <p className="text-xs text-muted-foreground mb-1">Sua função</p>
          <p className="font-semibold text-primary">{userRole}</p>
        </div>
      )}

      <div className="border-t border-border pt-4">
        <p className="text-xs text-muted-foreground mb-3">
          Equipe ({team.length} pessoas)
        </p>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {team.slice(0, 4).map((member, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-muted/50 text-xs max-w-[calc(50%-4px)] sm:max-w-none"
            >
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-primary-foreground shrink-0" title={member.name}>
                {getInitials(member.name)}
              </div>
              <span className="font-medium text-foreground truncate">{member.name}</span>
              {member.confirmed === true && (
                <Check className="w-3 h-3 text-green-600 shrink-0" />
              )}
              {member.confirmed === false && (
                <X className="w-3 h-3 text-red-500 shrink-0" />
              )}
            </div>
          ))}
          {team.length > 4 && (
            <div className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-muted text-xs font-medium text-muted-foreground">
              +{team.length - 4}
            </div>
          )}
        </div>
      </div>

      {confirmed === null && userRole && (
        <div className="flex gap-3 mt-4 pt-4 border-t border-border">
          <Button variant="default" size="sm" className="flex-1">
            <Check className="w-4 h-4 mr-1" />
            Confirmar
          </Button>
          <Button variant="outline" size="sm" className="flex-1">
            <X className="w-4 h-4 mr-1" />
            Indisponível
          </Button>
        </div>
      )}
    </div>
  );
}
