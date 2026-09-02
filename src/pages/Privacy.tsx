import { LandingNav } from "@/components/landing/LandingNav";
import { Footer } from "@/components/landing/Footer";
import { SEOHead } from "@/components/seo/SEOHead";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead path="/privacidade" />
      <LandingNav />
      <main className="container mx-auto px-6 pt-24 pb-16 max-w-3xl">
        <h1 className="text-3xl font-bold text-foreground mb-2">Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground mb-8">Última atualização: 10 de fevereiro de 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-foreground/90">
          <section>
            <h2 className="text-xl font-semibold text-foreground">1. Introdução</h2>
            <p>
              O Sirvo.app tem o compromisso de proteger a privacidade dos seus usuários. Esta Política de 
              Privacidade explica quais dados coletamos, como os utilizamos e quais são os seus direitos, 
              em conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD — Lei nº 13.709/2018).
            </p>
            <p>
              Ao utilizar a plataforma, você concorda com as práticas descritas nesta política.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">2. Quais Dados São Coletados</h2>
            <p>Coletamos apenas os dados necessários para o funcionamento da plataforma:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Dados de cadastro:</strong> nome completo, endereço de e-mail, telefone (opcional) 
                e foto de perfil (opcional).
              </li>
              <li>
                <strong>Dados de uso:</strong> informações sobre ministérios, escalas, eventos e 
                disponibilidade inseridas pelo usuário ou pelo administrador da organização.
              </li>
              <li>
                <strong>Dados de acesso:</strong> informações técnicas como endereço IP, tipo de 
                navegador e dispositivo, utilizados para segurança e melhoria do serviço.
              </li>
            </ul>
            <p>
              <strong>Não coletamos dados sensíveis</strong> como orientação religiosa, origem racial, 
              dados de saúde ou informações financeiras dos usuários.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">3. Finalidade do Uso dos Dados</h2>
            <p>Os dados coletados são utilizados para:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Permitir o funcionamento da plataforma (login, escalas, eventos, ministérios).</li>
              <li>Identificar usuários dentro de suas respectivas organizações.</li>
              <li>Enviar notificações relacionadas a escalas e eventos.</li>
              <li>Melhorar a experiência do usuário e o desempenho da plataforma.</li>
              <li>Garantir a segurança do sistema e prevenir abusos.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">4. Compartilhamento de Dados</h2>
            <p>
              <strong>Não vendemos, alugamos ou compartilhamos seus dados pessoais com terceiros para 
              fins comerciais.</strong>
            </p>
            <p>Seus dados podem ser compartilhados apenas nas seguintes situações:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Dentro da organização:</strong> administradores da sua igreja podem visualizar 
                informações necessárias para a gestão de escalas e equipes (como nome e disponibilidade).
              </li>
              <li>
                <strong>Prestadores de serviço:</strong> utilizamos serviços de terceiros para 
                infraestrutura e operação da plataforma, sempre sob compromissos de confidencialidade.
              </li>
              <li>
                <strong>Obrigação legal:</strong> quando exigido por lei ou ordem judicial.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">5. Armazenamento e Segurança</h2>
            <p>
              Seus dados são armazenados em servidores seguros com medidas de proteção técnicas e 
              organizacionais adequadas, incluindo criptografia e controle de acesso.
            </p>
            <p>
              Embora adotemos práticas reconhecidas de segurança, nenhum sistema é completamente imune 
              a riscos. Não podemos garantir segurança absoluta, mas nos comprometemos a agir rapidamente 
              em caso de qualquer incidente.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">6. Direitos do Titular dos Dados</h2>
            <p>
              De acordo com a LGPD, você tem os seguintes direitos sobre seus dados pessoais:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Acesso:</strong> saber quais dados temos sobre você.</li>
              <li><strong>Correção:</strong> solicitar a atualização de dados incompletos ou incorretos.</li>
              <li><strong>Exclusão:</strong> solicitar a remoção dos seus dados pessoais.</li>
              <li><strong>Portabilidade:</strong> solicitar seus dados em formato acessível.</li>
              <li><strong>Revogação do consentimento:</strong> retirar seu consentimento a qualquer momento.</li>
              <li><strong>Informação:</strong> saber com quem seus dados foram compartilhados.</li>
            </ul>
            <p>
              Para exercer qualquer um desses direitos, entre em contato conosco pelo canal indicado 
              ao final desta política. Responderemos em prazo razoável.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">7. Retenção e Exclusão de Dados</h2>
            <p>
              Mantemos seus dados enquanto sua conta estiver ativa ou conforme necessário para 
              prestar o serviço.
            </p>
            <p>
              Ao solicitar a exclusão da sua conta, seus dados pessoais serão removidos em até 30 dias, 
              exceto quando houver obrigação legal de retenção.
            </p>
            <p>
              Dados anonimizados ou agregados (que não permitem identificação) podem ser mantidos 
              para fins estatísticos e de melhoria do serviço.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">8. Alterações Nesta Política</h2>
            <p>
              Podemos atualizar esta Política de Privacidade periodicamente para refletir mudanças em 
              nossas práticas ou exigências legais.
            </p>
            <p>
              Quando alterações significativas forem realizadas, notificaremos os usuários pela 
              plataforma ou por e-mail. A data da última atualização será sempre indicada no topo 
              desta página.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">9. Canal de Contato</h2>
            <p>
              Se você tiver dúvidas sobre esta política, quiser exercer seus direitos ou precisar de 
              suporte relacionado à privacidade dos seus dados, entre em contato:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>E-mail:</strong> contato@sirvo.app</li>
            </ul>
            <p>
              Estamos à disposição para esclarecer qualquer dúvida.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Privacy;
