import { LandingNav } from "@/components/landing/LandingNav";
import { Footer } from "@/components/landing/Footer";
import { SEOHead } from "@/components/seo/SEOHead";

const Terms = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead path="/termos" />
      <LandingNav />
      <main className="container mx-auto px-6 pt-24 pb-16 max-w-3xl">
        <h1 className="text-3xl font-bold text-foreground mb-2">Termos de Uso</h1>
        <p className="text-sm text-muted-foreground mb-8">Última atualização: 10 de fevereiro de 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-foreground/90">
          <section>
            <h2 className="text-xl font-semibold text-foreground">1. Introdução e Aceite dos Termos</h2>
            <p>
              Bem-vindo ao Sirvo.app! Ao acessar ou utilizar nossa plataforma, você concorda com estes Termos de Uso. 
              Caso não concorde com algum dos termos descritos abaixo, pedimos que não utilize o serviço.
            </p>
            <p>
              O uso continuado da plataforma após eventuais atualizações destes termos implica na aceitação das alterações realizadas.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">2. Definições</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Plataforma:</strong> o aplicativo Sirvo.app, acessível via web e dispositivos móveis.</li>
              <li><strong>Usuário:</strong> qualquer pessoa que cria uma conta e utiliza a plataforma.</li>
              <li><strong>Administrador:</strong> usuário com permissões de gestão dentro de uma igreja ou organização.</li>
              <li><strong>Membro:</strong> usuário vinculado a uma igreja ou ministério dentro da plataforma.</li>
              <li><strong>Igreja/Organização:</strong> a entidade que utiliza a plataforma para gestão de suas atividades.</li>
              <li><strong>Ministério:</strong> grupo ou equipe dentro de uma igreja (ex: louvor, mídia, recepção).</li>
              <li><strong>Escala:</strong> distribuição de membros para servir em eventos específicos.</li>
              <li><strong>Evento:</strong> atividade da igreja com data e horário definidos (ex: culto, ensaio, reunião).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">3. Uso da Plataforma</h2>
            <p>
              O Sirvo.app é uma ferramenta de gestão de escalas, eventos e equipes voltada para igrejas e organizações religiosas. 
              A plataforma permite criar ministérios, cadastrar membros, organizar eventos e gerenciar escalas de voluntários.
            </p>
            <p>O usuário se compromete a:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Utilizar a plataforma de forma ética e respeitosa.</li>
              <li>Não utilizar o serviço para fins ilegais ou não autorizados.</li>
              <li>Não tentar acessar áreas restritas ou comprometer a segurança do sistema.</li>
              <li>Fornecer informações verdadeiras e atualizadas.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">4. Contas e Responsabilidades do Usuário</h2>
            <p>
              Para utilizar o Sirvo.app, é necessário criar uma conta com informações válidas. 
              Cada usuário é responsável por manter a segurança de suas credenciais de acesso (e-mail e senha).
            </p>
            <p>
              Você é responsável por todas as atividades realizadas em sua conta. Caso identifique qualquer uso 
              não autorizado, entre em contato conosco imediatamente.
            </p>
            <p>
              A plataforma não se responsabiliza por perdas ou danos decorrentes do compartilhamento de credenciais 
              de acesso com terceiros.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">5. Papel do Administrador</h2>
            <p>
              O administrador de uma igreja na plataforma possui permissões ampliadas, incluindo:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Criar e gerenciar ministérios e equipes.</li>
              <li>Convidar e remover membros.</li>
              <li>Criar eventos e escalas.</li>
              <li>Gerenciar permissões de outros usuários dentro da organização.</li>
            </ul>
            <p>
              O administrador é responsável pelo uso adequado dessas permissões e pelos dados inseridos por sua 
              organização na plataforma. A plataforma apenas fornece a ferramenta — a gestão e as decisões são 
              de responsabilidade da igreja ou organização.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">6. Disponibilidade e Manutenção</h2>
            <p>
              Nos esforçamos para manter o Sirvo.app disponível e funcionando corretamente, mas não garantimos 
              disponibilidade ininterrupta do serviço. A plataforma pode ficar temporariamente indisponível para:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Manutenções programadas ou emergenciais.</li>
              <li>Atualizações e melhorias no sistema.</li>
              <li>Eventos fora do nosso controle (falhas de infraestrutura, força maior, etc.).</li>
            </ul>
            <p>
              Sempre que possível, comunicaremos previamente sobre manutenções programadas.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">7. Limitação de Responsabilidade</h2>
            <p>
              O Sirvo.app é fornecido "como está" e "conforme disponível". Não nos responsabilizamos por:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Perdas de dados causadas por uso inadequado ou fatores externos.</li>
              <li>Decisões tomadas com base nas informações da plataforma.</li>
              <li>Danos indiretos, incidentais ou consequenciais decorrentes do uso do serviço.</li>
              <li>Conteúdo inserido pelos usuários na plataforma.</li>
            </ul>
            <p>
              A responsabilidade total da plataforma, em qualquer circunstância, está limitada ao valor pago 
              pelo usuário nos últimos 12 meses, quando aplicável.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">8. Propriedade Intelectual</h2>
            <p>
              Todo o conteúdo da plataforma Sirvo.app — incluindo marca, design, código, textos e funcionalidades — 
              é de propriedade do Sirvo.app ou de seus licenciadores.
            </p>
            <p>
              Os dados e conteúdos inseridos pelos usuários permanecem de propriedade dos respectivos usuários 
              e organizações. Ao utilizar a plataforma, você nos concede uma licença limitada para processar 
              e exibir esses dados conforme necessário para o funcionamento do serviço.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">9. Encerramento de Conta</h2>
            <p>
              Você pode encerrar sua conta a qualquer momento através das configurações do seu perfil ou 
              entrando em contato conosco.
            </p>
            <p>
              Reservamo-nos o direito de suspender ou encerrar contas que violem estes Termos de Uso, 
              sem aviso prévio, quando necessário para proteger a plataforma e seus usuários.
            </p>
            <p>
              Após o encerramento, seus dados poderão ser removidos conforme descrito em nossa Política de Privacidade.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">10. Alterações nos Termos</h2>
            <p>
              Podemos atualizar estes Termos de Uso periodicamente. Quando alterações significativas forem 
              realizadas, notificaremos os usuários através da plataforma ou por e-mail.
            </p>
            <p>
              A data da última atualização será sempre indicada no topo desta página. O uso continuado 
              da plataforma após as alterações constitui aceitação dos novos termos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">11. Canal de Contato</h2>
            <p>
              Se você tiver dúvidas, sugestões ou precisar de suporte, entre em contato conosco:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>E-mail:</strong> contato@sirvo.app</li>
            </ul>
            <p>
              Faremos o possível para responder em tempo hábil.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Terms;
