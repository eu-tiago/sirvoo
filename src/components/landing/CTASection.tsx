import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle } from "lucide-react";

const benefits = [
  "Sem necessidade de cartão de crédito",
  "Plano gratuito para até 3 usuários",
  "Suporte via chat incluído",
  "Configure em minutos",
];

export function CTASection() {
  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6 relative overflow-hidden">
      <div className="container mx-auto relative">
        <div className="relative max-w-5xl mx-auto bg-sirvo-navy-deep text-primary-foreground rounded-[2.5rem] overflow-hidden p-8 sm:p-14 text-center shadow-sirvo-lg">
          {/* Decorative blobs */}
          <div
            className="sirvo-blob-pink"
            style={{ width: 220, height: 220, top: -80, left: -80, opacity: 0.95 }}
          />
          <div
            className="sirvo-blob-green"
            style={{ width: 160, height: 160, top: -50, right: -50, opacity: 0.95 }}
          />

          <div className="relative">
            <h2 className="font-display font-black text-3xl sm:text-4xl md:text-5xl uppercase tracking-tight leading-tight mb-4">
              Pronto para transformar
              <br />
              sua igreja?
            </h2>
            <p className="text-base sm:text-lg opacity-90 max-w-2xl mx-auto mb-10">
              Junte-se a centenas de igrejas que já usam o Sirvo para organizar
              seus ministérios e voluntários.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-center gap-2 opacity-90">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span className="text-xs font-semibold uppercase tracking-wide">{benefit}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/auth?mode=signup">
                <Button
                  size="lg"
                  className="bg-success hover:bg-success/90 text-success-foreground text-sm px-8 py-6 rounded-2xl uppercase font-bold tracking-wide"
                >
                  Criar Conta Gratuita
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <Link to="/pricing">
                <Button
                  size="lg"
                  variant="outline"
                  className="text-sm px-8 py-6 border-2 border-white/40 bg-transparent text-primary-foreground hover:bg-white/10 hover:text-primary-foreground rounded-2xl uppercase font-bold tracking-wide"
                >
                  Ver Planos
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
