import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Menu,
  Home,
  ClipboardList,
  ArrowLeftRight,
  Users,
  Calendar,
  Shield,
  Church,
  DollarSign,
  Plug,
  Search,
  Megaphone,
  Settings,
  LogOut,
  User,
  HelpCircle,
  FileText,
  Music,
  BarChart3,
  CalendarOff,
} from "lucide-react";

export function MobileMenuSheet() {
  const [open, setOpen] = useState(false);
  const { isAdmin, isLeader, isSuperAdmin } = useUserRole();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const close = () => setOpen(false);

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

  const superAdminItems = [
    { to: "/admin/financeiro", icon: DollarSign, label: "Financeiro" },
    { to: "/admin/integracoes", icon: Plug, label: "Integrações" },
    { to: "/admin/seo", icon: Search, label: "SEO Manager" },
    { to: "/admin/comunicados", icon: Megaphone, label: "Comunicados" },
  ];

  const accountItems = [
    { to: "/profile", icon: User, label: "Perfil" },
    { to: "/ajuda", icon: HelpCircle, label: "Ajuda e Suporte" },
    { to: "/termos", icon: FileText, label: "Termos e Políticas" },
  ];

  const renderLink = (item: { to: string; icon: any; label: string }) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.to === "/dashboard"}
      onClick={close}
      className="flex items-center gap-3 px-3 py-3 rounded-xl text-foreground/80 hover:bg-muted transition-colors min-h-[44px]"
      activeClassName="bg-muted text-primary font-bold"
    >
      <item.icon className="w-5 h-5" />
      <span className="flex-1">{item.label}</span>
    </NavLink>
  );

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="space-y-1">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] px-3 mt-4 mb-2">
        {title}
      </p>
      {children}
    </div>
  );

  const handleSignOut = async () => {
    close();
    await signOut();
    navigate("/");
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="icon" variant="outline" className="h-11 w-11" aria-label="Abrir menu">
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[85vw] max-w-sm p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-3">
          <Section title="Navegação">{navItems.map(renderLink)}</Section>
          {(isFullAdmin || isLeader) && <Section title="Administração">{adminItems.map(renderLink)}</Section>}
          {isSuperAdmin && (
            <Section title="Super Admin">{superAdminItems.map(renderLink)}</Section>
          )}
          <Section title="Conta">{accountItems.map(renderLink)}</Section>
        </div>
        <div className="p-3 border-t">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/5"
            onClick={handleSignOut}
          >
            <LogOut className="w-5 h-5" />
            Sair da conta
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
