import { NavLink as RouterNavLink } from "@/components/NavLink";
import { Home, ClipboardList, User, CalendarDays, LayoutList } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";

export function BottomNav() {
  const { role, isSuperAdmin } = useUserRole();
  const canManage = role === "admin" || role === "ministry_leader" || isSuperAdmin;

  const navItems = canManage
    ? [
        { to: "/dashboard", icon: Home, label: "Início" },
        { to: "/calendar", icon: CalendarDays, label: "Agenda" },
        { to: "/planejamento", icon: LayoutList, label: "Escala" },
        { to: "/profile", icon: User, label: "Perfil" },
      ]
    : [
        { to: "/dashboard", icon: Home, label: "Início" },
        { to: "/schedules", icon: ClipboardList, label: "Minhas Escalas" },
        { to: "/profile", icon: User, label: "Perfil" },
      ];


  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 pb-safe">
      <div className="mx-3 mb-3 rounded-3xl bg-sirvo-navy-deep shadow-sirvo-lg">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
          {navItems.map((item) => (
            <RouterNavLink
              key={item.to}
              to={item.to}
              end={item.to === "/dashboard"}
              className="flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-2xl transition-all duration-300 text-primary-foreground/60 hover:text-primary-foreground min-w-[44px]"
              activeClassName="text-success"
            >
              {({ isActive }: { isActive: boolean }) => (
                <>
                  <div
                    className={cn(
                      "flex items-center justify-center w-9 h-9 rounded-xl transition-all",
                      isActive && "bg-success/15"
                    )}
                  >
                    <item.icon
                      className={cn("w-5 h-5 transition-all", isActive && "scale-110")}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-wide truncate max-w-[76px]">
                    {item.label}
                  </span>
                </>
              )}
            </RouterNavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
