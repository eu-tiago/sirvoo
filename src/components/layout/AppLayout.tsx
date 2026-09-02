import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { DesktopSidebar } from "./DesktopSidebar";
import { MobileHeader } from "./MobileHeader";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { useIsMobile } from "@/hooks/use-mobile";

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
  showMobileHeader?: boolean;
}

export function AppLayout({ children, title, showMobileHeader = true }: AppLayoutProps) {
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <DesktopSidebar />

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Mobile Header */}
        {showMobileHeader && <MobileHeader />}

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
