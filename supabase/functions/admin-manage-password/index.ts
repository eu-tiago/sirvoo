import { isMaster, callerPermission } from "../_shared/authorization.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const log = (step: string, details?: unknown) =>
  console.log(`[ADMIN-MANAGE-PASSWORD] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);

interface Payload {
  action: "set" | "reset";
  targetUserId: string;
  newPassword?: string;
  redirectTo?: string;
  churchId?: string;
}

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isWeakPasswordError = (message: string) =>
  /known to be weak|weak password|pwned|easy to guess/i.test(message);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Sem autorização");

    const { data: caller, error: callerError } = await admin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (callerError || !caller.user) throw new Error("Não autenticado");

    const { action, targetUserId, newPassword, redirectTo, churchId }: Payload = await req.json();
    if (!targetUserId) throw new Error("Usuário alvo não informado");

    const callerEmail = (caller.user.email ?? "").toLowerCase();
    const isSuperAdmin = await isMaster(req);

    let teamReset = false;
    if (!isSuperAdmin) {
      const { data: allowed, error: permError } = await admin.rpc("is_church_admin_of_user", {
        _admin_user_id: caller.user.id,
        _target_user_id: targetUserId,
      });
      if (permError) throw new Error("Erro ao verificar permissão");
      if (!allowed && action === "reset" && churchId) {
        teamReset = await callerPermission(req, "can_manage_team_user", { _target: targetUserId, _church_id: churchId });
      }
      if (!allowed && !teamReset) {
        return jsonResponse({ error: "Sem permissão para gerenciar este usuário" }, 403);
      }
    }

    const { data: target, error: targetError } = await admin.auth.admin.getUserById(targetUserId);
    if (targetError || !target.user) throw new Error("Usuário não encontrado");

    const { data: masterTarget } = await admin.from("platform_admin").select("user_id").eq("user_id", targetUserId).maybeSingle();
    const { data: memberships } = await admin.from("church_members").select("church_id").eq("user_id", targetUserId);
    if (!isSuperAdmin && (masterTarget || (!teamReset && (memberships?.length ?? 0) > 1))) {
      return jsonResponse({ error: "Esta conta deve gerenciar sua pr?pria senha" }, 403);
    }

    if (action === "set") {
      if (!newPassword || newPassword.length < 8) {
        throw new Error("A senha deve ter pelo menos 8 caracteres");
      }
      const { error } = await admin.auth.admin.updateUserById(targetUserId, {
        password: newPassword,
      });
      if (error) {
        if (isWeakPasswordError(error.message)) {
          // A senha rejeitada é um resultado esperado de validação. Retornamos
          // 200 para que o client mostre a orientação sem transformar isso em
          // falha de execução da função.
          return jsonResponse({
            success: false,
            code: "WEAK_PASSWORD",
            error: "Esta senha é muito comum ou já apareceu em vazamentos. Escolha uma senha mais forte, combinando letras, números e símbolos.",
          });
        }
        throw new Error(error.message);
      }
      log("Password set", { targetUserId });
      return jsonResponse({ success: true, action: "set" });
    }

    if (action === "reset") {
      const email = target.user.email;
      if (!email) throw new Error("Usuário sem email cadastrado");

      const { error } = await admin.auth.resetPasswordForEmail(email, {
        redirectTo: redirectTo ?? undefined,
      });
      if (error) throw new Error(error.message);
      log("Reset email sent", { targetUserId });
      return jsonResponse({ success: true, action: "reset" });
    }

    throw new Error("Ação inválida");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    log("ERROR", { message });
    return jsonResponse({ error: message }, 400);
  }
});
