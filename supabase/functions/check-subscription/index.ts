import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json", "Cache-Control": "no-store" };
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  try {
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: "N?o autenticado" }), { headers, status: 401 });
    let { churchId } = await req.json().catch(() => ({}));
    if (!churchId) {
      const { data } = await client.from("church_members").select("church_id").eq("user_id", user.id).order("joined_at").order("church_id").limit(1).maybeSingle();
      churchId = data?.church_id;
    }
    if (!churchId) throw new Error("Igreja n?o informada");
    // RLS authorizes the church; Stripe email is never used as tenant identity.
    const { data, error } = await client.rpc("get_church_subscription", { _church_id: churchId });
    if (error || !data) return new Response(JSON.stringify({ error: "Assinatura indispon?vel nesta igreja" }), { headers, status: 403 });
    return new Response(JSON.stringify(data), { headers });
  } catch {
    return new Response(JSON.stringify({ error: "Erro ao consultar assinatura" }), { headers, status: 400 });
  }
});
