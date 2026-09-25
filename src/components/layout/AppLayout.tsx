import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { DesktopSidebar } from "./DesktopSidebar";
import { MobileHeader } from "./MobileHeader";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { useIsMobile } from "@/hooks/use-mobile";
import { useChurch } from "@/hooks/ChurchContext";
import { useUserRole } from "@/hooks/useUserRole";

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
  showMobileHeader?: boolean;
}

export function AppLayout({ children, title, showMobileHeader = true }: AppLayoutProps) {
  const isMobile = useIsMobile();
  const { church, churches, selectChurch } = useChurch();
  const { isSuperAdmin } = useUserRole();

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <DesktopSidebar />

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Mobile Header */}
        {showMobileHeader && <MobileHeader />}
        {isSuperAdmin && churches.length > 0 && (
          <div className="px-4 py-3 border-b flex items-center gap-3">
            <label htmlFor="active-church" className="text-sm font-medium">Igreja em administração</label>
            <select id="active-church" className="bg-background border rounded-md p-2 max-w-xs"
              value={church?.id ?? ""} onChange={event => selectChurch(event.target.value)}>
              {churches.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
        )}

        {/* Page Content */}
        <main className="pb-16 sm:pb-20 lg:pb-6">
          {children}
        </main>

        {/* Mobile Bottom Nav */}
        <div className="lg:hidden">
          <BottomNav />
        </div>
      </div>

      {/* PWA Install Prompt - Mobile Only */}
      {isMobile && <InstallPrompt />}
    </div>
  );
}
