import { User, Shield, ShieldCheck, Users as UsersIcon, MoreVertical, KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserCardProps {
  id: string;
  name: string;
  email: string;
  role: "admin" | "ministry_leader" | "volunteer";
  avatarUrl?: string;
  onChangeRole: (userId: string, newRole: "admin" | "ministry_leader" | "volunteer") => void;
  onRemove: (userId: string) => void;
  onManagePassword?: (userId: string) => void;
  canManage: boolean;
}

const roleConfig = {
  admin: {
    label: "Administrador",
    icon: ShieldCheck,
    color: "bg-primary/10 text-primary border-primary/20",
  },
  ministry_leader: {
    label: "Líder",
    icon: Shield,
    color: "bg-amber-100 text-amber-700 border-amber-200",
  },
  volunteer: {
    label: "Voluntário",
    icon: UsersIcon,
    color: "bg-muted text-muted-foreground border-border",
  },
};

export function UserCard({
  id,
  name,
  email,
  role,
  avatarUrl,
  onChangeRole,
  onRemove,
  onManagePassword,
  canManage,
}: UserCardProps) {
  const config = roleConfig[role];
  const RoleIcon = config.icon;
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="sirvo-card flex items-center gap-2 md:gap-4 transition-all duration-300 hover:shadow-sirvo-lg overflow-hidden p-3 md:p-4">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className="w-10 h-10 md:w-12 md:h-12 rounded-xl object-cover shrink-0"
        />
      ) : (
        <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
          <span className="text-xs md:text-sm font-bold text-primary-foreground">
            {initials}
          </span>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground truncate text-sm md:text-base">{name}</p>
        <p className="text-xs md:text-sm text-muted-foreground truncate">{email}</p>
      </div>

      <Badge
        variant="outline"
        className={`hidden sm:flex items-center gap-1.5 px-3 py-1 shrink-0 ${config.color}`}
      >
        <RoleIcon className="w-3.5 h-3.5" />
        {config.label}
      </Badge>

      {canManage && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {role !== "admin" && (
              <DropdownMenuItem onClick={() => onChangeRole(id, "admin")}>
                <ShieldCheck className="w-4 h-4 mr-2" />
                Tornar Administrador
              </DropdownMenuItem>
            )}
            {role !== "ministry_leader" && (
              <DropdownMenuItem onClick={() => onChangeRole(id, "ministry_leader")}>
                <Shield className="w-4 h-4 mr-2" />
                Tornar Líder
              </DropdownMenuItem>
            )}
            {role !== "volunteer" && (
              <DropdownMenuItem onClick={() => onChangeRole(id, "volunteer")}>
                <UsersIcon className="w-4 h-4 mr-2" />
                Tornar Voluntário
              </DropdownMenuItem>
            )}
            {onManagePassword && (
              <DropdownMenuItem onClick={() => onManagePassword(id)}>
                <KeyRound className="w-4 h-4 mr-2" />
                Alterar / Resetar senha
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => onRemove(id)}
              className="text-destructive focus:text-destructive"
            >
              <User className="w-4 h-4 mr-2" />
              Remover Usuário
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}