import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPER_ADMIN_EMAIL = "tiagotalmud@gmail.com";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function csvEscape(value: string | null | undefined) {
  const v = (value ?? "").toString();
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

async function getCallerUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data } = await supabase.auth.getUser();
  return data.user;
}

async function getSegmentedUsers(segment: "all" | "free" | "premium") {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1) Find churches per plan
  let churchIds: string[] | null = null;
  if (segment !== "all") {
    const plans =
      segment === "free" ? ["free"] : ["basic", "standard"];
    const { data: subs, error } = await admin
      .from("church_subscriptions")
      .select("church_id, plan")
      .in("plan", plans);
    if (error) throw error;
    churchIds = (subs ?? []).map((s) => s.church_id);
    if (churchIds.length === 0) return [];
  }

  // 2) Find users in those churches
  let membersQuery = admin
    .from("church_members")
    .select("user_id, church_id");
  if (churchIds) membersQuery = membersQuery.in("church_id", churchIds);
  const { data: members, error: mErr } = await membersQuery;
  if (mErr) throw mErr;

  const userIds = Array.from(
    new Set((members ?? []).map((m) => m.user_id)),
  );
  if (userIds.length === 0) return [];

  // 3) Profiles
  const { data: profiles, error: pErr } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .in("id", userIds);
  if (pErr) throw pErr;

  // 4) Churches + plan map
  const uniqueChurchIds = Array.from(
    new Set((members ?? []).map((m) => m.church_id)),
  );
  const { data: churches } = await admin
    .from("churches")
    .select("id, name")
    .in("id", uniqueChurchIds);
  const { data: allSubs } = await admin
    .from("church_subscriptions")
    .select("church_id, plan")
    .in("church_id", uniqueChurchIds);

  const churchName = new Map(
    (churches ?? []).map((c) => [c.id, c.name]),
  );
  const churchPlan = new Map(
    (allSubs ?? []).map((s) => [s.church_id, s.plan]),
  );
  const userChurch = new Map(
    (members ?? []).map((m) => [m.user_id, m.church_id]),
  );

  return (profiles ?? []).map((p) => {
    const cId = userChurch.get(p.id) as string | undefined;
    return {
      user_id: p.id,
      full_name: p.full_name ?? "",
      email: p.email ?? "",
      church_name: cId ? churchName.get(cId) ?? "" : "",
      plan: cId ? churchPlan.get(cId) ?? "free" : "free",
    };
  });
}

async function callLovableAI(prompt: string, system: string) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const resp = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
    },
  );

  if (resp.status === 429) {
    throw new Error("Limite de requisições atingido. Tente novamente.");
  }
  if (resp.status === 402) {
    throw new Error("Créditos de IA esgotados. Adicione créditos.");
  }
  if (!resp.ok) {
    const t = await resp.text();
    console.error("AI gateway error", resp.status, t);
    throw new Error("Erro no gateway de IA");
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await getCallerUser(req);
    if (!user) return json({ error: "Não autenticado" }, 401);
    if (
      (user.email ?? "").toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()
    ) {
      return json({ error: "Acesso restrito ao super admin" }, 403);
    }

    const body = await req.json();
    const action = body.action as string;

    // -----------------------------
    // 1) Segment preview / count
    // -----------------------------
    if (action === "count") {
      const segment = (body.segment ?? "all") as "all" | "free" | "premium";
      const users = await getSegmentedUsers(segment);
      return json({ count: users.length });
    }

    // -----------------------------
    // 2) Export CSV
    // -----------------------------
    if (action === "export") {
      const segment = (body.segment ?? "all") as "all" | "free" | "premium";
      const users = await getSegmentedUsers(segment);
      const header = "Nome,Email,Igreja,Plano\n";
      const rows = users
        .map((u) =>
          [u.full_name, u.email, u.church_name, u.plan]
            .map(csvEscape)
            .join(","),
        )
        .join("\n");
      const csv = header + rows;

      // log export
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      await admin.from("admin_broadcasts").insert({
        sent_by: user.id,
        segment,
        channel: "export",
        title: `Exportação CSV (${segment})`,
        message: `${users.length} contatos exportados`,
        recipients_count: users.length,
      });

      return new Response(csv, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/csv; charset=utf-8",
        },
      });
    }

    // -----------------------------
    // 3) AI generation
    // -----------------------------
    if (action === "ai_generate") {
      const kind = body.kind as
        | "subject"
        | "body"
        | "cta"
        | "ideas";
      const topic = (body.topic ?? "").toString().slice(0, 1000);
      const audience = (body.audience ?? "all") as
        | "all"
        | "free"
        | "premium";

      const audienceLabel =
        audience === "free"
          ? "igrejas em plano gratuito"
          : audience === "premium"
            ? "igrejas em plano pago (Basic/Standard)"
            : "todos os usuários do Sirvo";

      const systemBase = `Você é assistente de marketing do Sirvo, plataforma de gestão de escalas para igrejas. Tom: acolhedor, claro, profissional, em PT-BR. Público: ${audienceLabel}. Nunca prometa funcionalidades inexistentes. Não use emojis em excesso.`;

      let prompt = "";
      switch (kind) {
        case "subject":
          prompt = `Gere 5 sugestões curtas de ASSUNTO (máx 60 caracteres) para o comunicado sobre: "${topic}". Retorne uma lista numerada simples.`;
          break;
        case "body":
          prompt = `Escreva um CORPO de comunicado curto (máx 180 palavras) sobre: "${topic}". Estruture em: saudação, contexto, benefício, próximo passo. Sem assinatura.`;
          break;
        case "cta":
          prompt = `Sugira 5 CTAs (call-to-action) curtos (máx 4 palavras) para o comunicado sobre: "${topic}". Lista numerada.`;
          break;
        case "ideas":
          prompt = `Gere 5 IDEIAS PROMOCIONAIS para ${audienceLabel} relacionadas a: "${topic}". Cada ideia em 1-2 linhas. Lista numerada.`;
          break;
        default:
          return json({ error: "kind inválido" }, 400);
      }

      const content = await callLovableAI(prompt, systemBase);
      return json({ content });
    }

    // -----------------------------
    // 4) Send in-app notification
    // -----------------------------
    if (action === "send_in_app") {
      const segment = (body.segment ?? "all") as "all" | "free" | "premium";
      const title = (body.title ?? "").toString().trim();
      const message = (body.message ?? "").toString().trim();
      const cta = (body.cta ?? "").toString().trim() || null;

      if (!title || title.length > 140) {
        return json({ error: "Título obrigatório (até 140 chars)" }, 400);
      }
      if (!message || message.length > 2000) {
        return json({ error: "Mensagem obrigatória (até 2000 chars)" }, 400);
      }

      const users = await getSegmentedUsers(segment);
      if (users.length === 0) {
        return json({ error: "Nenhum destinatário no segmento" }, 400);
      }

      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      const fullMessage = cta ? `${message}\n\n${cta}` : message;
      const rows = users.map((u) => ({
        user_id: u.user_id,
        title,
        message: fullMessage,
        type: "broadcast",
      }));

      // chunk insert (1000 at a time)
      for (let i = 0; i < rows.length; i += 1000) {
        const chunk = rows.slice(i, i + 1000);
        const { error } = await admin.from("notifications").insert(chunk);
        if (error) {
          console.error("insert notifications error", error);
          return json({ error: error.message }, 500);
        }
      }

      await admin.from("admin_broadcasts").insert({
        sent_by: user.id,
        segment,
        channel: "in_app",
        title,
        message,
        cta,
        recipients_count: users.length,
      });

      return json({ ok: true, recipients: users.length });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    console.error("admin-broadcast error", e);
    return json(
      { error: e instanceof Error ? e.message : "Erro interno" },
      500,
    );
  }
});
