import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, Users, Bell, Search } from "lucide-react";

export function HeroSection() {
  return (
    <section className="pt-24 sm:pt-32 pb-12 sm:pb-20 px-4 sm:px-6 relative overflow-hidden">
      <div className="container mx-auto relative">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Copy */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-success/15 text-success text-xs font-bold uppercase tracking-wider mb-8 animate-fade-in">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse-soft" />
              Plataforma para igrejas
            </div>

            <h1 className="font-display font-black text-4xl sm:text-5xl lg:text-7xl uppercase text-foreground leading-[0.95] tracking-tight animate-slide-up">
              Olá, igreja!{" "}
              <span className="block text-primary">
                Você tem escalas
              </span>
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground mt-6 max-w-lg mx-auto lg:mx-0 animate-slide-up stagger-1 leading-relaxed">
              Sirvo é a plataforma completa para gestão de voluntários em igrejas.
              Crie escalas, gerencie ministérios e notifique sua equipe automaticamente.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mt-8 animate-slide-up stagger-2">
              <Link to="/auth?mode=signup">
                <Button size="lg" className="sirvo-btn-primary text-sm px-7 py-6">
                  Começar Grátis
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <a href="#features">
                <Button size="lg" variant="outline" className="text-sm px-7 py-6 border-2 rounded-2xl uppercase font-bold tracking-wide">
                  Ver Funcionalidades
                </Button>
              </a>
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center lg:justify-start gap-6 animate-fade-in stagger-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-accent" />
                <span className="text-xs font-bold uppercase tracking-wide text-foreground/70">
                  Escalas
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-success" />
                <span className="text-xs font-bold uppercase tracking-wide text-foreground/70">
                  Ministérios
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wide text-foreground/70">
                  Notificações
                </span>
              </div>
            </div>
          </div>

          {/* Phone mockup card */}
          <div className="relative animate-slide-up stagger-4 max-w-sm mx-auto w-full">
            <div className="relative rounded-[2.5rem] overflow-hidden shadow-sirvo-lg bg-card">
              {/* Navy header */}
              <div className="relative bg-sirvo-navy-deep text-primary-foreground rounded-b-[2.5rem] overflow-hidden">
                <div
                  className="sirvo-blob-pink"
                  style={{ width: 140, height: 140, top: -50, left: -50 }}
                />
                <div
                  className="sirvo-blob-green"
                  style={{ width: 90, height: 90, top: -25, right: -25 }}
                />
                <div className="relative p-6 pb-8">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">
                    Olá,
                  </p>
                  <h3 className="font-display font-black text-3xl uppercase mt-1 leading-none">
                    Pastor !
                  </h3>
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-90 mt-1">
                    Você tem escalas
                  </p>

                  <div className="mt-5 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <div className="h-10 rounded-full bg-card flex items-center pl-10 pr-4 text-xs text-muted-foreground">
                      Buscar...
                    </div>
                  </div>
                </div>
              </div>

              {/* Lavender body */}
              <div className="bg-sirvo-lavender-soft/40 px-5 py-6 space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
                  Próximas escalas
                </p>

                <div className="space-y-3">
                  <div className="bg-card rounded-2xl p-3 flex items-center gap-3">
                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-black uppercase">19:00</p>
                      <p className="text-[9px] font-bold text-muted-foreground">DOM</p>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-accent" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black uppercase truncate">Culto Noite</p>
                      <p className="text-[10px] text-muted-foreground truncate">Louvor • Vocal</p>
                    </div>
                  </div>

                  <div className="bg-card rounded-2xl p-3 flex items-center gap-3">
                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-black uppercase">10:20</p>
                      <p className="text-[9px] font-bold text-muted-foreground">QUA</p>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-accent" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black uppercase truncate">Reunião Líderes</p>
                      <p className="text-[10px] text-muted-foreground truncate">Recepção</p>
                    </div>
                  </div>
                </div>

                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary pt-2">
                  Últimas
                </p>
                <div className="bg-card rounded-2xl px-3 py-2.5 flex items-center gap-2">
                  <Bell className="w-3.5 h-3.5 text-primary shrink-0" />
                  <p className="text-[11px] font-bold uppercase truncate">
                    Confirmação recebida
                  </p>
                </div>
              </div>
            </div>

            {/* Floating decorative blobs around phone */}
            <div
              className="absolute -z-10 rounded-full"
              style={{
                width: 220,
                height: 220,
                background: "hsl(var(--accent) / 0.15)",
                top: -30,
                right: -40,
                filter: "blur(40px)",
              }}
            />
            <div
              className="absolute -z-10 rounded-full"
              style={{
                width: 180,
                height: 180,
                background: "hsl(var(--success) / 0.15)",
                bottom: -20,
                left: -30,
                filter: "blur(40px)",
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
