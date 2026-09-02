import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPER_ADMIN_EMAIL = "tiagotalmud@gmail.com";

const log = (step: string, details?: unknown) =>
  console.log(`[ADMIN-MANAGE-USERS] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Action = "list" | "link_church" | "unlink_church" | "delete_user";

interface Payload {
  action: Action;
  targetUserId?: string;
  churchId?: string;
  role?: "admin" | "ministry_leader" | "volunteer";
}

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
    if (!authHeader) return jsonResponse({ error: "Sem autorização" }, 401);

    const { data: caller, error: callerError } = await admin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (callerError || !caller.user) return jsonResponse({ error: "Não autenticado" }, 401);

    const callerEmail = (caller.user.email ?? "").toLowerCase();
    if (callerEmail !== SUPER_ADMIN_EMAIL) {
      return jsonResponse({ error: "Apenas o super administrador pode usar esta função" }, 403);
    }

    const { action, targetUserId, churchId, role }: Payload = await req.json();

    if (action === "list") {
      const { data: profiles, error: profilesError } = await admin
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .order("full_name", { ascending: true });
      if (profilesError) throw new Error(profilesError.message);

      const { data: memberships, error: membershipsError } = await admin
        .from("church_members")
        .select("user_id, church_id, role, churches(name)");
      if (membershipsError) throw new Error(membershipsError.message);

      const { data: churches, error: churchesError } = await admin
        .from("churches")
        .select("id, name")
        .order("name", { ascending: true });
      if (churchesError) throw new Error(churchesError.message);

      const users = (profiles ?? []).map((p) => ({
        id: p.id,
        name: p.full_name || "Sem nome",
        email: p.email || "",
        avatarUrl: p.avatar_url || undefined,
        churches: (memberships ?? [])
          .filter((m) => m.user_id === p.id)
          .map((m) => ({
            churchId: m.church_id,
            churchName:
              (m as { churches?: { name?: string } | null }).churches?.name ?? "Igreja",
            role: m.role,
          })),
      }));

      return jsonResponse({ users, churches: churches ?? [] });
    }

    if (!targetUserId) return jsonResponse({ error: "Usuário alvo não informado" }, 400);

    if (action === "link_church") {
      if (!churchId) return jsonResponse({ error: "Igreja não informada" }, 400);
      const { error } = await admin
        .from("church_members")
        .upsert(
          { user_id: targetUserId, church_id: churchId, role: role ?? "volunteer" },
          { onConflict: "user_id,church_id" }
        );
      if (error) throw new Error(error.message);

      await admin
        .from("user_roles")
        .upsert({ user_id: targetUserId, role: role ?? "volunteer" }, { onConflict: "user_id,role" });

      log("Linked", { targetUserId, churchId });
      return jsonResponse({ success: true });
    }

    if (action === "unlink_church") {
      if (!churchId) return jsonResponse({ error: "Igreja não informada" }, 400);
      const { error } = await admin
        .from("church_members")
        .delete()
        .eq("user_id", targetUserId)
        .eq("church_id", churchId);
      if (error) throw new Error(error.message);
      log("Unlinked", { targetUserId, churchId });
      return jsonResponse({ success: true });
    }

    if (action === "delete_user") {
      if (targetUserId === caller.user.id) {
        return jsonResponse({ error: "Você não pode excluir o próprio usuário" }, 400);
      }

      await admin.from("schedule_assignments").delete().eq("user_id", targetUserId);
      await admin.from("ministry_members").delete().eq("user_id", targetUserId);
      await admin.from("church_members").delete().eq("user_id", targetUserId);
      await admin.from("user_roles").delete().eq("user_id", targetUserId);
      await admin.from("push_subscriptions").delete().eq("user_id", targetUserId);
      await admin.from("volunteer_availability").delete().eq("user_id", targetUserId);
      await admin.from("notifications").delete().eq("user_id", targetUserId);

      const { error: authError } = await admin.auth.admin.deleteUser(targetUserId);
      if (authError && !/not found/i.test(authError.message)) {
        throw new Error(authError.message);
      }

      await admin.from("profiles").delete().eq("id", targetUserId);

      log("Deleted", { targetUserId });
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Ação inválida" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    log("ERROR", { message });
    return jsonResponse({ error: message }, 400);
  }
});
