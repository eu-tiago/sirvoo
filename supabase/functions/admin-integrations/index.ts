import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPERADMIN_EMAIL = "tiagotalmud@gmail.com";

const log = (s: string, d?: any) =>
  console.log(`[ADMIN-INTEGRATIONS] ${s}${d ? " - " + JSON.stringify(d) : ""}`);

interface IntegrationStatus {
  id: string;
  name: string;
  category: string;
  description: string;
  configured: boolean;
  healthy: boolean;
  details: string;
  secrets: { name: string; present: boolean; masked?: string }[];
  docsUrl?: string;
  managed?: boolean; // managed = configurado pela plataforma, não editável manualmente
}

function mask(value: string | undefined): string {
  if (!value) return "—";
  return value;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr) throw new Error(userErr.message);
    const user = userData.user;
    if (!user?.email || user.email.toLowerCase() !== SUPERADMIN_EMAIL.toLowerCase()) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || "list";

    // ---------- TEST INDIVIDUAL INTEGRATION ----------
    if (action === "test") {
      const id = body.id as string;
      log("test", { id });

      if (id === "stripe") {
        const key = Deno.env.get("STRIPE_SECRET_KEY");
        if (!key) throw new Error("STRIPE_SECRET_KEY ausente");
        const stripe = new Stripe(key, { apiVersion: "2025-08-27.basil" });
        const acct = await stripe.accounts.retrieve();
        return new Response(
          JSON.stringify({
            ok: true,
            message: `Conectado à conta Stripe: ${acct.email || acct.id} (${acct.country})`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (id === "resend") {
        const key = Deno.env.get("RESEND_API_KEY");
        if (!key) throw new Error("RESEND_API_KEY ausente");
        const resp = await fetch("https://api.resend.com/domains", {
          headers: { Authorization: `Bearer ${key}` },
        });
        if (!resp.ok) {
          const txt = await resp.text();
          throw new Error(`Resend retornou ${resp.status}: ${txt}`);
        }
        const data = await resp.json();
        const domains = (data?.data || []).map((d: any) => `${d.name} (${d.status})`).join(", ");
        return new Response(
          JSON.stringify({
            ok: true,
            message: domains
              ? `Conectado. Domínios: ${domains}`
              : "Conectado. Nenhum domínio cadastrado ainda.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (id === "lovable_ai") {
        const key = Deno.env.get("LOVABLE_API_KEY");
        if (!key) throw new Error("LOVABLE_API_KEY ausente");
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 5,
          }),
        });
        if (!resp.ok) {
          const txt = await resp.text();
          throw new Error(`Lovable AI retornou ${resp.status}: ${txt.slice(0, 200)}`);
        }
        return new Response(
          JSON.stringify({ ok: true, message: "Lovable AI Gateway respondendo normalmente." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (id === "vapid") {
        const pub = Deno.env.get("VAPID_PUBLIC_KEY");
        const priv = Deno.env.get("VAPID_PRIVATE_KEY");
        if (!pub || !priv) throw new Error("Chaves VAPID ausentes");
        // Verifica formato base64url
        const valid = /^[A-Za-z0-9_-]+$/.test(pub) && pub.length >= 80;
        if (!valid) throw new Error("VAPID_PUBLIC_KEY parece inválida (formato esperado base64url, ~88 chars)");
        const { count } = await supabase
          .from("push_subscriptions")
          .select("id", { count: "exact", head: true });
        return new Response(
          JSON.stringify({
            ok: true,
            message: `Chaves VAPID válidas. ${count ?? 0} dispositivo(s) inscrito(s).`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (id === "stripe_webhook") {
        const sec = Deno.env.get("STRIPE_WEBHOOK_SECRET");
        if (!sec) throw new Error("STRIPE_WEBHOOK_SECRET ausente");
        if (!sec.startsWith("whsec_")) throw new Error("Formato suspeito (esperado whsec_...)");
        return new Response(
          JSON.stringify({ ok: true, message: "Webhook secret presente e com formato válido." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (id === "supabase") {
        const { data, error } = await supabase.from("churches").select("id", { count: "exact", head: true });
        if (error) throw new Error(error.message);
        return new Response(
          JSON.stringify({ ok: true, message: "Banco de dados acessível." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Integração desconhecida: ${id}`);
    }

    // ---------- LIST ALL INTEGRATIONS ----------
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const stripeWebhook = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const vapidPub = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPriv = Deno.env.get("VAPID_PRIVATE_KEY");
    const supaUrl = Deno.env.get("SUPABASE_URL");
    const supaSrv = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const integrations: IntegrationStatus[] = [
      {
        id: "stripe",
        name: "Stripe",
        category: "Pagamentos",
        description: "Processa cobranças recorrentes dos planos (Básico e Padrão).",
        configured: !!stripeKey,
        healthy: !!stripeKey,
        details: stripeKey
          ? "Chave secreta configurada. Use 'Testar' para validar a conexão."
          : "Sem chave secreta. Configure STRIPE_SECRET_KEY para habilitar pagamentos.",
        secrets: [
          { name: "STRIPE_SECRET_KEY", present: !!stripeKey, masked: mask(stripeKey) },
        ],
        docsUrl: "https://dashboard.stripe.com/apikeys",
      },
      {
        id: "stripe_webhook",
        name: "Stripe Webhook",
        category: "Pagamentos",
        description: "Recebe notificações automáticas do Stripe (pagamentos, cancelamentos).",
        configured: !!stripeWebhook,
        healthy: !!stripeWebhook && stripeWebhook.startsWith("whsec_"),
        details: stripeWebhook
          ? `URL: ${supaUrl}/functions/v1/stripe-webhook`
          : "Cadastre o endpoint stripe-webhook no painel Stripe e cole o whsec_ aqui.",
        secrets: [
          { name: "STRIPE_WEBHOOK_SECRET", present: !!stripeWebhook, masked: mask(stripeWebhook) },
        ],
        docsUrl: "https://dashboard.stripe.com/webhooks",
      },
      {
        id: "resend",
        name: "Resend (E-mails)",
        category: "Comunicação",
        description: "Envia convites, recuperação de senha e notificações por e-mail.",
        configured: !!resendKey,
        healthy: !!resendKey,
        details: resendKey
          ? "Remetente: no-reply@sirvo.app"
          : "Sem chave. E-mails transacionais não serão enviados.",
        secrets: [
          { name: "RESEND_API_KEY", present: !!resendKey, masked: mask(resendKey) },
        ],
        docsUrl: "https://resend.com/api-keys",
      },
      {
        id: "lovable_ai",
        name: "Lovable AI Gateway",
        category: "Inteligência Artificial",
        description: "Alimenta o chatbot de suporte (/ajuda) com modelos Gemini e GPT.",
        configured: !!lovableKey,
        healthy: !!lovableKey,
        details: lovableKey
          ? "Gerenciado pela plataforma. Sem custo até os limites do plano."
          : "Chave ausente. Suporte por IA indisponível.",
        secrets: [
          { name: "LOVABLE_API_KEY", present: !!lovableKey, masked: mask(lovableKey) },
        ],
        managed: true,
      },
      {
        id: "vapid",
        name: "Push Notifications (VAPID)",
        category: "Notificações",
        description: "Chaves de criptografia para enviar notificações push aos dispositivos.",
        configured: !!vapidPub && !!vapidPriv,
        healthy: !!vapidPub && !!vapidPriv,
        details:
          vapidPub && vapidPriv
            ? "Par de chaves configurado. Necessário para notificações push funcionarem."
            : "Faltam chaves. Gere um par VAPID e cadastre nos secrets.",
        secrets: [
          { name: "VAPID_PUBLIC_KEY", present: !!vapidPub, masked: mask(vapidPub) },
          { name: "VAPID_PRIVATE_KEY", present: !!vapidPriv, masked: mask(vapidPriv) },
        ],
        docsUrl: "https://vapidkeys.com/",
      },
      {
        id: "supabase",
        name: "Backend (Lovable Cloud)",
        category: "Infraestrutura",
        description: "Banco de dados, autenticação, storage e edge functions.",
        configured: !!supaUrl && !!supaSrv,
        healthy: !!supaUrl && !!supaSrv,
        details: "Gerenciado pela plataforma. Não pode ser editado manualmente.",
        secrets: [
          { name: "SUPABASE_URL", present: !!supaUrl, masked: supaUrl || "—" },
          { name: "SUPABASE_SERVICE_ROLE_KEY", present: !!supaSrv, masked: mask(supaSrv) },
        ],
        managed: true,
      },
    ];

    const summary = {
      total: integrations.length,
      configured: integrations.filter((i) => i.configured).length,
      healthy: integrations.filter((i) => i.healthy).length,
      missing: integrations.filter((i) => !i.configured).length,
    };

    return new Response(JSON.stringify({ integrations, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    log("error", { msg: error.message });
    return new Response(JSON.stringify({ error: error.message, ok: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
