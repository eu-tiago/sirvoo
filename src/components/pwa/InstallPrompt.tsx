import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Download, Smartphone, Share, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isInStandaloneMode = window.matchMedia("(display-mode: standalone)").matches;
    setIsInstalled(isInStandaloneMode);
    if (isInStandaloneMode) return;

    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Check if prompt was dismissed
    const dismissed = localStorage.getItem("pwa-prompt-dismissed");
    const dismissedTime = dismissed ? parseInt(dismissed) : 0;
    const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
    
    // Show again after 7 days
    if (dismissed && daysSinceDismissed < 7) return;

    // iOS prompt
    if (isIOSDevice) {
      setTimeout(() => setShowPrompt(true), 5000);
      return;
    }

    // Android/Chrome prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("pwa-prompt-dismissed", Date.now().toString());
  };

  if (!showPrompt || isInstalled) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-slide-up">
      <div className="bg-card border border-border rounded-2xl p-4 shadow-sirvo-lg max-w-md mx-auto">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl sirvo-gradient-bg flex items-center justify-center flex-shrink-0 shadow-sirvo">
            <Smartphone className="w-7 h-7 text-primary-foreground" />
          </div>

          <div className="flex-1 pr-6">
            <h3 className="font-bold text-foreground text-lg mb-1">
              Instalar Sirvo
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {isIOS
                ? "Adicione à tela inicial para acesso rápido e experiência de app nativo"
                : "Instale o app para acessar offline e receber notificações"}
            </p>

            {isIOS ? (
              <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-medium text-foreground">Como instalar:</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <Share className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="text-muted-foreground">
                      Toque em <span className="font-medium text-foreground">Compartilhar</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <Plus className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="text-muted-foreground">
                      Selecione <span className="font-medium text-foreground">"Adicionar à Tela de Início"</span>
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <Button onClick={handleInstall} className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Instalar Agora
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
