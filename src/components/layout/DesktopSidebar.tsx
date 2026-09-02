import { NavLink } from "@/components/NavLink";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { 
  Home, 
  Calendar, 
  CalendarOff,

  Users, 
  ClipboardList, 
  Shield, 
  Church,
  LogOut,
  Settings,
  ChevronRight,
  ArrowLeftRight,
  DollarSign,
  Plug,
  Search,
  Megaphone,
  Music,
  BarChart3
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import sirvoLogo from "@/assets/sirvo-logo.png";

export function DesktopSidebar() {
  const { profile, loading } = useUserProfile();
  const { isAdmin, isLeader, isSuperAdmin } = useUserRole();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const isFullAdmin = isAdmin || isSuperAdmin;
  const navItems = isFullAdmin
    ? [
        { to: "/dashboard", icon: Home, label: "Início" },
        { to: "/schedules", icon: ClipboardList, label: "Minhas Escalas" },
        { to: "/planejamento", icon: ClipboardList, label: "Planejamento" },
        { to: "/swap-requests", icon: ArrowLeftRight, label: "Trocas" },
        { to: "/ministries", icon: Users, label: "Ministérios" },
        { to: "/louvor", icon: Music, label: "Louvor" },
        { to: "/calendar", icon: Calendar, label: "Agenda" },
        { to: "/relatorios", icon: BarChart3, label: "Relatórios" },
        { to: "/disponibilidade", icon: CalendarOff, label: "Minhas Disponibilidades" },
      ]
    : isLeader
    ? [
        { to: "/dashboard", icon: Home, label: "Início" },
        { to: "/schedules", icon: ClipboardList, label: "Minhas Escalas" },
        { to: "/planejamento", icon: ClipboardList, label: "Planejamento" },
        { to: "/swap-requests", icon: ArrowLeftRight, label: "Trocas" },
        { to: "/ministries", icon: Users, label: "Ministérios" },
        { to: "/calendar", icon: Calendar, label: "Agenda" },
        { to: "/relatorios", icon: BarChart3, label: "Relatórios" },
        { to: "/disponibilidade", icon: CalendarOff, label: "Minhas Disponibilidades" },
      ]
    : [
        { to: "/dashboard", icon: Home, label: "Início" },
        { to: "/schedules", icon: ClipboardList, label: "Minhas Escalas" },
        { to: "/swap-requests", icon: ArrowLeftRight, label: "Trocas" },
        { to: "/calendar", icon: Calendar, label: "Agenda" },
        { to: "/disponibilidade", icon: CalendarOff, label: "Minhas Disponibilidades" },
      ];

  const adminItems = isFullAdmin
    ? [
        { to: "/users", icon: Shield, label: "Usuários" },
        { to: "/churches", icon: Church, label: "Igrejas" },
      ]
    : [{ to: "/users", icon: Shield, label: "Usuários" }];


  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const getRoleBadge = (role: string) => {
    if (isSuperAdmin) {
      return { label: "Super Admin", className: "bg-destructive/10 text-destructive" };
    }
    const roleLabels: Record<string, { label: string; className: string }> = {
      admin: { label: "Admin", className: "bg-primary/10 text-primary" },
      ministry_leader: { label: "Líder", className: "bg-amber-500/10 text-amber-600" },
      volunteer: { label: "Voluntário", className: "bg-green-500/10 text-green-600" },
    };
    return roleLabels[role] || roleLabels.volunteer;
  };

  return (
    <aside className="hidden lg:flex flex-col w-64 h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border fixed left-0 top-0">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img
            src={sirvoLogo}
            alt="Sirvo"
            className="h-12 w-auto object-contain"
          />
        </div>
        {profile?.churchName && (
          <p className="text-xs uppercase tracking-wider font-semibold text-sidebar-foreground/70 mt-3">
            {profile.churchName}
          </p>
        )}
      </div>

      {/* User Info */}
      <div className="p-4 border-b border-sidebar-border">
        {loading ? (
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ) : profile ? (
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-lg font-bold text-primary-foreground">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.fullName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                profile.fullName.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate">
                {profile.fullName}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={cn("text-xs", getRoleBadge(profile.role).className)}>
                  {getRoleBadge(profile.role).label}
                </Badge>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <p className="text-[10px] font-bold text-sidebar-foreground/50 uppercase tracking-[0.15em] mb-3 px-3">
          Menu
        </p>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/dashboard"}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all"
            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-bold"
          >
            {({ isActive }: { isActive: boolean }) => (
              <>
                <item.icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                <span className="flex-1">{item.label}</span>
                {isActive && <ChevronRight className="w-4 h-4" />}
              </>
            )}
          </NavLink>
        ))}

        {isSuperAdmin && (
          <>
            <p className="text-[10px] font-bold text-sidebar-foreground/50 uppercase tracking-[0.15em] mt-6 mb-3 px-3">
              Super Admin
            </p>
            <NavLink
              to="/admin/financeiro"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all"
              activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-bold"
            >
              {({ isActive }: { isActive: boolean }) => (
                <>
                  <DollarSign className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                  <span className="flex-1">Financeiro</span>
                  {isActive && <ChevronRight className="w-4 h-4" />}
                </>
              )}
            </NavLink>
            <NavLink
              to="/admin/integracoes"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all"
              activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-bold"
            >
              {({ isActive }: { isActive: boolean }) => (
                <>
                  <Plug className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                  <span className="flex-1">Integrações</span>
                  {isActive && <ChevronRight className="w-4 h-4" />}
                </>
              )}
            </NavLink>
            <NavLink
              to="/admin/seo"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all"
              activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-bold"
            >
              {({ isActive }: { isActive: boolean }) => (
                <>
                  <Search className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                  <span className="flex-1">SEO Manager</span>
                  {isActive && <ChevronRight className="w-4 h-4" />}
                </>
              )}
            </NavLink>
            <NavLink
              to="/admin/comunicados"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all"
              activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-bold"
            >
              {({ isActive }: { isActive: boolean }) => (
                <>
                  <Megaphone className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                  <span className="flex-1">Comunicados</span>
                  {isActive && <ChevronRight className="w-4 h-4" />}
                </>
              )}
            </NavLink>
          </>
        )}

        {(isFullAdmin || isLeader) && (
          <>
            <p className="text-[10px] font-bold text-sidebar-foreground/50 uppercase tracking-[0.15em] mt-6 mb-3 px-3">
              Administração
            </p>
            {adminItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all"
                activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-bold"
              >
                {({ isActive }: { isActive: boolean }) => (
                  <>
                    <item.icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                    <span className="flex-1">{item.label}</span>
                    {isActive && <ChevronRight className="w-4 h-4" />}
                  </>
                )}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border space-y-1">
        <NavLink
          to="/profile"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all"
          activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-bold"
        >
          {({ isActive }: { isActive: boolean }) => (
            <>
              <Settings className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
              <span>Configurações</span>
            </>
          )}
        </NavLink>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 px-3 py-2.5 text-sidebar-foreground/70 hover:text-destructive hover:bg-sidebar-accent"
          onClick={handleSignOut}
        >
          <LogOut className="w-5 h-5" />
          <span>Sair</span>
        </Button>
      </div>
    </aside>
  );
}
