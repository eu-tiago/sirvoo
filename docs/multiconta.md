# Multiconta por igreja

## Exclusão de contas de teste no financeiro

Em Financeiro → Igrejas e assinaturas, o Admin Master pode usar **Excluir** e confirmar digitando o nome exato da igreja. O servidor exige autorização Master e executa a exclusão em uma transação: igreja, assinatura local, vínculos e dados operacionais relacionados. Os logins, perfis pessoais e vínculos com outras igrejas são preservados. Arquivos físicos já enviados ao Storage não são apagados por esta operação.

Contas com identificadores de cliente ou assinatura Stripe são bloqueadas, mesmo que o plano local esteja Free. O vínculo financeiro deve ser revisado e encerrado antes da exclusão; o botão não cancela cobranças nem apaga histórico no Stripe.

Para disponibilizar o botão, aplicar também `20260925130000_delete_church_account.sql` e publicar `admin-financial` e o frontend. A RPC de exclusão só pode ser executada pela service role, após a validação do Master na Edge Function. Nenhuma conta real foi excluída durante o desenvolvimento.

As permissões são aplicadas no PostgreSQL (RLS, funções e triggers) e nas Edge Functions. O navegador apenas apresenta as ações permitidas.

| Papel | Acesso |
| --- | --- |
| Admin Master | Administração de todas as igrejas, usuários, planos e integrações; seletor de igreja na aplicação. |
| Administrador | Usuários, papéis, dados e contratação do plano da própria igreja. |
| Líder | Visualiza, cadastra voluntários, edita nomes, envia redefinição de senha por e-mail e remove integrantes dos ministérios em que possui `ministry_members.is_leader = true`. Não promove papéis nem gerencia outras equipes. |
| Voluntário | Consulta os dados operacionais da igreja, administra seu perfil e disponibilidade, confirma suas escalas e responde às trocas dirigidas a ele. |

`church_members.role` é a fonte do papel por igreja. `user_roles` permanece apenas por compatibilidade com dados antigos. Tabelas operacionais pertencem a uma igreja diretamente ou por seus vínculos; triggers rejeitam referências cruzadas entre igrejas e funções de outro ministério. Perfis e preferências pessoais pertencem ao usuário autenticado.

Existe no máximo uma linha em `platform_admin`. A migração associa o Master ao UUID da conta verificada já configurada no projeto (`tiagotalmud@gmail.com`). O e-mail não é usado para autorizar requisições após essa associação. Se essa conta não existir ou não estiver verificada, um operador do banco precisa provisionar explicitamente o UUID correto antes da publicação. Não existe autopromoção pelo aplicativo.

Toda igreja nasce com assinatura Free de 3 membros, incluindo o administrador inicial. Convites pendentes não reservam vagas: o limite é verificado novamente ao vincular o membro. O trigger também se aplica à service role e ao Master, e serializa inclusões pela linha da igreja. Planos pagos preservam os limites existentes; assinaturas fora de `active`/`trialing` usam o limite Free. Downgrade não apaga membros existentes, mas bloqueia novas inclusões acima do limite.

Contas existentes devem aceitar um convite, em vez de serem vinculadas automaticamente por e-mail de perfil. Trocas de escala são respondidas por uma RPC com autorização e transação únicas.

## Correção de plano ilimitado e escopo dos líderes

Aplicar `20260925140000_unlimited_and_leader_directory.sql` após as migrações anteriores e publicar o frontend, `check-subscription`, `send-invite` e `admin-financial`. O plano ilimitado ativo autoriza novos membros independentemente de valores antigos em `max_users`; não depende de um número artificialmente alto. O cadastro, convite e consulta de assinatura usam a mesma RPC `get_church_subscription`. Erros de consulta são exibidos como erros, sem apresentar falsamente o plano Free. Assinaturas canceladas continuam com a restrição Free; esta mudança não reativa assinaturas.

O Líder sem ministério marcado como liderado vê uma lista vazia. Políticas restritivas protegem consultas diretas de perfis, vínculos e a RPC `list_safe_profiles`, além da filtragem da tela. Os testes cobrem dois ministérios na mesma igreja, um líder que é membro comum de outro ministério, revogação da liderança, tentativas de alteração e ilimitado com `max_users = 3`.

## Gestão da equipe pelo Líder

Aplicar também `20260925150000_leader_team_management.sql` e publicar `create-user`, `admin-manage-password` e o frontend. O cadastro exige pelo menos um ministério liderado pelo solicitante e papel Voluntário; a autorização é conferida antes de criar a conta Auth e novamente na transação que grava a igreja e os ministérios. Os limites do plano continuam valendo para todos.

O Líder edita o nome do perfil (compartilhado entre os vínculos do usuário), sem alterar e-mail, papel ou equipes. A redefinição envia um link ao e-mail registrado no Auth; o Líder não define uma senha manualmente. Remover exclui os vínculos e escalas dos ministérios liderados, preservando outras equipes, a conta Auth e o vínculo com a igreja. Esse usuário continua contando no plano até um administrador removê-lo da igreja. Convites de contas existentes continuam exclusivos dos administradores.

Os dados reais da igreja Videira Nações não foram consultados nem alterados nesta correção local; após publicar, conferir seu `plan`, `status` e o papel do usuário que tentou cadastrar.

## Configuração e implantação

1. Configurar `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` no ambiente do frontend, conforme `.env.example`. Para execução local, os valores públicos anteriormente presentes no código foram preservados em `.env.local`, ignorado pelo Git.
2. Em homologação, aplicar `supabase/migrations/20260925120000_enforce_church_tenancy.sql` sobre o schema existente, verificar o UUID do Master e executar os fluxos reais de cadastro, convite e cobrança. A migração não elimina dados antigos inconsistentes; novos vínculos inválidos serão rejeitados.
3. Publicar em conjunto a migração, o frontend e as funções alteradas: `accept-invite`, `admin-broadcast`, `admin-financial`, `admin-integrations`, `admin-manage-password`, `admin-manage-users`, `check-subscription`, `create-checkout`, `create-user`, `customer-portal`, `send-invite`, incluindo `_shared/authorization.ts`.
4. Rotacionar os segredos que o endpoint antigo de integrações devolvia: Supabase service role, Stripe secret/webhook, Resend, Lovable AI e VAPID privado. Atualizar os respectivos secrets do servidor e integrações dependentes. A rotação VAPID pode exigir nova inscrição dos dispositivos. A correção de código não invalida cópias de chaves já expostas.
5. Conferir assinaturas antigas: cada cliente Stripe deve estar vinculado à igreja correta. Os novos checkouts criam clientes por igreja, sem deduzir a conta pelo e-mail do administrador. Clientes antigos compartilhados entre igrejas precisam de reconciliação antes de habilitar seu portal financeiro.

A chave pública/anon do Supabase continuará visível no navegador por projeto; ela não é um segredo. Chaves secretas nunca devem entrar em variáveis `VITE_*`. O cliente rejeita chaves secretas conhecidas. Referência: [chaves do Supabase](https://supabase.com/docs/guides/getting-started/api-keys).

## Validação

`npm run test:security` executa PostgreSQL em memória (PGlite) com fixtures mínimas de Auth/Storage e testes das Edge Functions com serviços simulados. Abrange isolamento, papéis, Free, upgrade, gravação por service role, vínculos cruzados, troca de escala, exclusividade do Master e ausência de segredos nas respostas. O teste usa geração simplificada do token de convite porque a fixture não carrega pgcrypto.

`npm run typecheck` verifica o frontend. `npm run build` gera a aplicação. Funções Deno não são verificadas pelo TypeScript do navegador.

Os testes locais não substituem a aplicação de todo o histórico de migrações, testes concorrentes em conexões PostgreSQL independentes, testes de navegador ou a integração real com Supabase Auth, Stripe, e-mail e push. Nenhuma migração, função ou rotação foi aplicada ao ambiente remoto nesta alteração.
