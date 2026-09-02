import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LandingNav } from "@/components/landing/LandingNav";
import { Footer } from "@/components/landing/Footer";
import { SEOHead } from "@/components/seo/SEOHead";
import { Check, Star, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useChurchId } from "@/hooks/useChurchId";
import { useSubscription } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";

const plans = [
  {
    id: "free",
    name: "Gratuito",
    price: "R$ 0",
    period: "/mês",
    description: "Ideal para igrejas pequenas que estão começando",
    users: "Até 3 usuários",
    maxUsers: 3,
    features: [
      "Até 3 usuários",
      "2 ministérios",
      "Escalas básicas",
      "Notificações por email",
      "Suporte por email"
    ],
    cta: "Começar Grátis",
    popular: false
  },
  {
    id: "basic",
    name: "Básico",
    price: "R$ 29,90",
    period: "/mês",
    description: "Para igrejas em crescimento com mais ministérios",
    users: "Até 10 usuários",
    maxUsers: 10,
    features: [
      "Até 10 usuários",
      "5 ministérios",
      "Escalas avançadas",
      "Notificações push",
      "Relatórios básicos",
      "Suporte prioritário"
    ],
    cta: "Assinar Agora",
    popular: true
  },
  {
    id: "standard",
    name: "Standard",
    price: "R$ 59,90",
    period: "/mês",
    description: "Para igrejas maiores com necessidades completas",
    users: "Até 30 usuários",
    maxUsers: 30,
    features: [
      "Até 30 usuários",
      "Ministérios ilimitados",
      "Escalas avançadas",
      "Notificações push",
      "Relatórios completos",
      "Multi-igreja",
      "API de integração",
      "Suporte premium 24/7"
    ],
    cta: "Assinar Agora",
    popular: false
  }
];

const Pricing = () => {
  const { user } = useAuth();
  const { churchId } = useChurchId();
  const { subscription, loading, checkSubscription, createCheckout, openCustomerPortal } = useSubscription();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);

  useEffect(() => {
    if (user && churchId) {
      checkSubscription(churchId);
    }
  }, [user, churchId, checkSubscription]);

  const handleSelectPlan = async (planId: string) => {
    if (!user) {
      navigate("/auth?mode=signup");
      return;
    }

    if (!churchId) {
      toast({
        title: "Igreja não encontrada",
        description: "Você precisa estar associado a uma igreja para assinar.",
        variant: "destructive",
      });
      return;
    }

    if (planId === "free") {
      toast({
        title: "Plano Gratuito",
        description: "Você já está no plano gratuito.",
      });
      return;
    }

    if (subscription?.plan === planId) {
      // User already has this plan, open portal to manage
      await openCustomerPortal();
      return;
    }

    setProcessingPlan(planId);
    await createCheckout(planId as "basic" | "standard", churchId);
    setProcessingPlan(null);
  };

  const getButtonText = (planId: string, defaultText: string) => {
    if (!user) return defaultText;
    if (subscription?.plan === planId) return "Plano Atual";
    if (planId === "free" && subscription?.plan !== "free") return "Downgrade";
    return defaultText;
  };

  const isCurrentPlan = (planId: string) => subscription?.plan === planId;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead path="/pricing" />
      <LandingNav />
      
      <main className="pt-20 md:pt-32 pb-20 px-4 md:px-6">
        <div className="container mx-auto">
          {/* Header */}
          <div className="text-center mb-8 md:mb-16">
            <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-foreground mb-3 md:mb-4">
              Planos que{" "}
              <span className="sirvo-gradient-text">cabem no seu bolso</span>
            </h1>
            <p className="text-sm md:text-lg text-muted-foreground max-w-2xl mx-auto">
              Escolha o plano ideal para sua igreja. Comece gratuitamente e evolua conforme suas necessidades.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto">
            {plans.map((plan, index) => (
              <div 
                key={plan.name}
                className={`relative rounded-2xl p-6 md:p-8 transition-all duration-300 hover:-translate-y-2 animate-slide-up ${
                  plan.popular 
                    ? "bg-card border-2 border-primary shadow-sirvo-lg" 
                    : isCurrentPlan(plan.id)
                    ? "bg-card border-2 border-green-500 shadow-sirvo-lg"
                    : "bg-card border border-border/50 shadow-sirvo"
                }`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {plan.popular && !isCurrentPlan(plan.id) && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full sirvo-gradient-bg text-primary-foreground text-sm font-medium">
                      <Star className="w-4 h-4" />
                      Mais Popular
                    </div>
                  </div>
                )}

                {isCurrentPlan(plan.id) && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-green-500 text-white text-sm font-medium">
                      <Check className="w-4 h-4" />
                      Seu Plano
                    </div>
                  </div>
                )}

                <div className="text-center mb-8">
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    {plan.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {plan.description}
                  </p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-foreground">
                      {plan.price}
                    </span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  <p className="text-sm text-primary font-medium mt-2">
                    {plan.users}
                  </p>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-primary" />
                      </div>
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button 
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={loading || processingPlan !== null}
                  className={`w-full py-6 font-semibold ${
                    isCurrentPlan(plan.id)
                      ? "bg-green-500 hover:bg-green-600 text-white"
                      : plan.popular 
                      ? "sirvo-btn-primary" 
                      : "bg-muted hover:bg-muted/80 text-foreground"
                  }`}
                >
                  {processingPlan === plan.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    getButtonText(plan.id, plan.cta)
                  )}
                </Button>
              </div>
            ))}
          </div>

          {/* Manage Subscription */}
          {user && subscription?.subscribed && (
            <div className="mt-12 text-center">
              <Button 
                variant="outline" 
                onClick={openCustomerPortal}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Gerenciar Assinatura
              </Button>
              {subscription.subscription_end && (
                <p className="text-sm text-muted-foreground mt-2">
                  Próxima cobrança: {new Date(subscription.subscription_end).toLocaleDateString("pt-BR")}
                </p>
              )}
            </div>
          )}

          {/* FAQ or Additional Info */}
          <div className="mt-20 text-center">
            <p className="text-muted-foreground">
              Precisa de mais usuários ou funcionalidades personalizadas?{" "}
              <a href="mailto:contato@sirvo.app" className="text-primary hover:underline">
                Fale conosco
              </a>
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Pricing;
