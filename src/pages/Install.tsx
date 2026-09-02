import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, Smartphone, Share, Plus, Check, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const isMobile = useIsMobile();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const isInStandaloneMode = window.matchMedia("(display-mode: standalone)").matches;
    setIsInstalled(isInStandaloneMode);

    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
      setCanInstall(false);
    }
  };

  const features = [
    "Acesso rápido pela tela inicial",
    "Funciona mesmo offline",
    "Notificações de escalas",
    "Experiência de app nativo",
    "Atualizações automáticas",
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="px-4 py-4 border-b border-border">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
          <span>Voltar</span>
        </Link>
      </header>

      <div className="max-w-lg mx-auto px-6 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="w-24 h-24 rounded-3xl sirvo-gradient-bg flex items-center justify-center mx-auto mb-6 shadow-sirvo-lg">
            <Smartphone className="w-12 h-12 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">
            Instalar Sirvo
          </h1>
          <p className="text-muted-foreground">
            Tenha o Sirvo sempre à mão como um app nativo no seu dispositivo
          </p>
        </div>

        {/* Status */}
        {isInstalled ? (
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6 text-center mb-8">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="font-semibold text-green-600 mb-2">App Instalado!</h2>
            <p className="text-sm text-muted-foreground">
              O Sirvo já está instalado no seu dispositivo
            </p>
          </div>
        ) : (
          <>
            {/* Features */}
            <div className="bg-muted/30 rounded-2xl p-6 mb-8">
              <h2 className="font-semibold text-foreground mb-4">
                Por que instalar?
              </h2>
              <ul className="space-y-3">
                {features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Install Instructions */}
            {isIOS ? (
              <div className="space-y-6">
                <div className="bg-card border border-border rounded-2xl p-6">
                  <h2 className="font-semibold text-foreground mb-4">
                    Como instalar no iPhone/iPad
                  </h2>
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full sirvo-gradient-bg flex items-center justify-center text-primary-foreground font-bold text-sm flex-shrink-0">
                        1
                      </div>
                      <div>
                        <p className="font-medium text-foreground mb-1">
                          Toque no botão Compartilhar
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Na barra inferior do Safari, toque no ícone{" "}
                          <Share className="w-4 h-4 inline text-primary" />
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full sirvo-gradient-bg flex items-center justify-center text-primary-foreground font-bold text-sm flex-shrink-0">
                        2
                      </div>
                      <div>
                        <p className="font-medium text-foreground mb-1">
                          Adicionar à Tela de Início
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Role para baixo e toque em "Adicionar à Tela de Início"
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full sirvo-gradient-bg flex items-center justify-center text-primary-foreground font-bold text-sm flex-shrink-0">
                        3
                      </div>
                      <div>
                        <p className="font-medium text-foreground mb-1">
                          Confirme a instalação
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Toque em "Adicionar" no canto superior direito
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : canInstall ? (
              <Button onClick={handleInstall} size="lg" className="w-full">
                <Download className="w-5 h-5 mr-2" />
                Instalar Sirvo
              </Button>
            ) : (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 text-center">
                <p className="text-sm text-amber-600">
                  A instalação não está disponível neste navegador. 
                  Tente abrir no Chrome ou Edge para instalar.
                </p>
              </div>
            )}
          </>
        )}

        {/* Back Link */}
        <div className="text-center mt-8">
          <Link 
            to="/dashboard" 
            className="text-sm text-primary hover:underline"
          >
            Continuar no navegador
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Install;
