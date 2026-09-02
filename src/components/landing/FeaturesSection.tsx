import { 
  Calendar, 
  Users, 
  Bell, 
  Music, 
  Monitor, 
  Shield,
  Clock,
  UserCheck,
  Zap
} from "lucide-react";

const features = [
  {
    icon: Calendar,
    title: "Escalas Inteligentes",
    description: "Crie e gerencie escalas para todos os ministérios. Atribua funções, horários e equipes de forma simples e organizada."
  },
  {
    icon: Users,
    title: "Gestão de Ministérios",
    description: "Configure ministérios como Louvor, Mídia, Som, Iluminação, Recepção, Infantil e muito mais. Cada um com suas próprias funções."
  },
  {
    icon: Bell,
    title: "Notificações Automáticas",
    description: "Voluntários recebem notificações quando são escalados, quando precisam de substituição e lembretes antes dos eventos."
  },
  {
    icon: UserCheck,
    title: "Confirmação de Presença",
    description: "Voluntários podem confirmar ou recusar participação com um clique. Facilita a gestão de substituições."
  },
  {
    icon: Clock,
    title: "Disponibilidade",
    description: "Cada voluntário pode informar sua disponibilidade. O sistema considera isso ao criar novas escalas."
  },
  {
    icon: Music,
    title: "Escala de Louvor",
    description: "Módulo especializado com funções como vocal líder, backing vocal, instrumentos e apoio técnico."
  },
  {
    icon: Monitor,
    title: "Mídia e Transmissão",
    description: "Gerencie operadores de ProPresenter, streaming, câmeras e toda equipe de mídia."
  },
  {
    icon: Zap,
    title: "Iluminação",
    description: "Escalas específicas para operadores, técnicos e equipe de cena com diferentes modos de evento."
  },
  {
    icon: Shield,
    title: "Permissões por Função",
    description: "Administradores, líderes de ministério e voluntários têm acessos diferentes conforme suas responsabilidades."
  }
];

const accentRotation = [
  "bg-primary text-primary-foreground",
  "bg-accent text-accent-foreground",
  "bg-success text-success-foreground",
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-12 sm:py-20 px-4 sm:px-6 bg-sirvo-lavender-soft/30">
      <div className="container mx-auto">
        <div className="text-center mb-16">
          <p className="label-caps text-primary mb-3">Funcionalidades</p>
          <h2 className="font-display font-black text-3xl sm:text-4xl md:text-5xl uppercase text-foreground tracking-tight leading-tight">
            Tudo que você precisa para{" "}
            <span className="text-accent">organizar sua igreja</span>
          </h2>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto mt-4">
            Funcionalidades completas pensadas especialmente para a realidade das igrejas brasileiras.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="bg-card rounded-3xl p-6 border border-border/40 shadow-sirvo-soft hover:shadow-sirvo-lg transition-all duration-300 hover:-translate-y-1 animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
                  accentRotation[index % accentRotation.length]
                }`}
              >
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="font-display font-black text-base uppercase text-foreground mb-2 tracking-tight">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
