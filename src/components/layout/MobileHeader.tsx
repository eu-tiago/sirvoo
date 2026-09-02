import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useState, useEffect } from "react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import sirvoLogo from "@/assets/sirvo-logo.png";
import { MobileMenuSheet } from "./MobileMenuSheet";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface MobileHeaderProps {
  showInstallButton?: boolean;
}

export function MobileHeader({ showInstallButton = true }: MobileHeaderProps) {
  const { profile, loading } = useUserProfile();

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const isInStandaloneMode = window.matchMedia("(display-mode: standalone)").matches;

    if (isInStandaloneMode) return;

    const handler = (e: Event) => {
      e.preventDefault();

      setDeferredPrompt(e as BeforeInstallPromptEvent);

      setCanInstall(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setCanInstall(false);
    }

    setDeferredPrompt(null);
  };

  return (
    <header
      className="
        lg:hidden
        sticky
        top-0
        z-50
        bg-background/95
        backdrop-blur-xl
        border-b
        border-border/50
        shadow-sm
        pt-[calc(env(safe-area-inset-top)+10px)]
      "
    >
      <div
        className="
          flex
          items-center
          justify-between
          px-4
          min-h-[72px]
        "
      >
        {/* LEFT */}
        <div className="flex items-center gap-2 min-w-[72px]">
          <div className="flex items-center justify-center w-11 h-11">
            <MobileMenuSheet />
          </div>

          {showInstallButton && canInstall && (
            <Button size="icon" variant="outline" onClick={handleInstall} className="w-10 h-10">
              <Download className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* CENTER */}
        <div className="flex-1 flex justify-center">
          <img
            src={sirvoLogo}
            alt="Sirvo"
            className="
              h-8
              w-auto
              object-contain
              select-none
            "
          />
        </div>

        {/* RIGHT */}
        <div className="flex justify-end min-w-[72px]">
          {loading ? (
            <Skeleton className="w-10 h-10 rounded-full" />
          ) : (
            <Link to="/profile" className="block">
              <div
                className="
                  w-10
                  h-10
                  rounded-full
                  bg-gradient-to-br
                  from-primary
                  to-secondary
                  flex
                  items-center
                  justify-center
                  text-sm
                  font-bold
                  text-primary-foreground
                  overflow-hidden
                "
              >
                {profile?.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.fullName}
                    className="
                      w-full
                      h-full
                      object-cover
                    "
                  />
                ) : (
                  profile?.fullName?.charAt(0).toUpperCase() || "U"
                )}
              </div>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
