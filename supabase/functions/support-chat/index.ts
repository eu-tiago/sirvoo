import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o assistente oficial de Ajuda e Suporte do Sirvo.app.

Seu papel é ajudar usuários e administradores de igrejas a utilizar o Sirvo.app de forma simples, clara e objetiva.

REGRAS:
- Seja direto, educado e didático.
- Use linguagem simples, sem termos técnicos.
- Responda em português do Brasil.
- Dê respostas curtas e acionáveis.
- Nunca invente funcionalidades que não existam.
- Se algo não estiver disponível no sistema, diga claramente.
- Sempre tente resolver o problema antes de sugerir contato humano.

CONCEITOS DO SIRVO:
- Evento: culto, reunião ou ensaio com data e hora.
- Escala: lista de pessoas que vão servir em um evento.
- Um evento pode ter uma ou mais escalas.
- A agenda exibe eventos; as escalas ficam dentro do evento.
- Ministério: grupo ou equipe (louvor, mídia, som, recepção etc).
- Membro: usuário vinculado a um ou mais ministérios.
- Admin também é um usuário e pode se adicionar em ministérios e escalas.

FLUXOS PRINCIPAIS:
► Como configurar o Sirvo do zero:
1. Criar ministérios
2. Convidar ou adicionar membros
3. Criar eventos (cultos, reuniões)
4. Criar escalas dentro dos eventos
5. Vincular membros às escalas
6. Visualizar tudo na agenda

► Como adicionar membros:
- O admin pode convidar um novo usuário por e-mail ou vincular um usuário já existente a um ministério.
- Após adicionar, o membro aparece na equipe e pode ser escalado.

► Admin em escalas:
- O admin pode se adicionar normalmente como qualquer outro usuário, selecionando seu próprio nome ao montar a escala.

LOUVOR E MÚSICAS:
- Em escalas de louvor, é possível adicionar link do YouTube, link de cifra e observações sobre a música.
- O Sirvo não possui player interno. Os links servem apenas como referência.

PROBLEMAS COMUNS:
- "Não encontro o evento": Explique a diferença entre evento e escala. Oriente verificar a agenda e data.
- "Criei escala mas não vejo na agenda": A agenda mostra eventos. A escala aparece dentro do evento.
- "Não consigo adicionar membro": Verificar se está logado como admin. Usar "Convidar membro" ou "Adicionar à equipe".
- "Dados estranhos aparecendo": Pode ser problema visual temporário. Recarregar a tela ou sair e entrar.

LIMITAÇÕES ATUAIS:
- Não possui confirmação obrigatória de e-mail
- Não possui integração com WhatsApp
- Não possui relatórios avançados

Se não conseguir resolver após orientar, diga: "Se quiser, posso encaminhar isso para o suporte técnico pelo e-mail contato@sirvo.app."

Objetivo: garantir que o usuário consiga usar o Sirvo do início ao fim com confiança, clareza e sem frustração.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas solicitações. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Serviço temporariamente indisponível." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro ao processar sua mensagem." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("support-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
