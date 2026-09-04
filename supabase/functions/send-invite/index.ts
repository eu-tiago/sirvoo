import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-INVITE] ${step}${detailsStr}`);
};

interface InviteRequest {
  email: string;
  role: "admin" | "ministry_leader" | "volunteer";
  churchId: string;
  churchName: string;
  inviterName: string;
  ministryId?: string;
  resend?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const { email, role: requestedRole, churchId, churchName, inviterName, ministryId, resend }: InviteRequest = await req.json();
    logStep("Invite request received", { email, role: requestedRole, churchId, ministryId });

    const { data: membership, error: membershipError } = await supabaseClient
      .from("church_members")
      .select("role")
      .eq("church_id", churchId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) throw new Error("Erro ao verificar permissão na igreja");
    if (!membership || !["admin", "ministry_leader"].includes(membership.role)) {
      throw new Error("Você não tem permissão para convidar membros desta igreja");
    }

    const role = membership.role === "ministry_leader" ? "volunteer" : requestedRole;
    if (!["admin", "ministry_leader", "volunteer"].includes(role)) {
      throw new Error("Função de convite inválida");
    }

    // Check if user can add more users (subscription limit) — super admin bypasses
    const isSuperAdmin = (user.email || "").toLowerCase() === "tiagotalmud@gmail.com";

    if (!isSuperAdmin) {
      const { data: canAdd, error: canAddError } = await supabaseClient
        .rpc("can_add_church_user", { _church_id: churchId });

      if (canAddError) {
        logStep("Error checking subscription limit", { error: canAddError });
        throw new Error("Erro ao verificar limite de usuários");
      }

      if (!canAdd) {
        logStep("User limit reached for church", { churchId });
        return new Response(
          JSON.stringify({ error: "Limite de usuários atingido no plano atual" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
    }

    // Check if email already exists in the church
    const { data: existingProfile } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile) {
      const { data: existingMember } = await supabaseClient
        .from("church_members")
        .select("id")
        .eq("user_id", existingProfile.id)
        .eq("church_id", churchId)
        .maybeSingle();

      if (existingMember) {
        return new Response(
          JSON.stringify({ error: "Este usuário já é membro desta igreja" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
    }

    // Check for existing pending invite
    const { data: existingInvite } = await supabaseClient
      .from("invitations")
      .select("id")
      .eq("email", email)
      .eq("church_id", churchId)
      .eq("status", "pending")
      .maybeSingle();

    if (existingInvite) {
      // Update existing invite instead of creating new
      await supabaseClient
        .from("invitations")
        .update({
          role,
          ministry_id: ministryId || null,
          invited_by: user.id,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("id", existingInvite.id);
      
      logStep("Updated existing pending invite", { inviteId: existingInvite.id });
    }

    // Create invitation record with token
    let inviteToken: string;
    
    if (existingInvite) {
      const { data: updated } = await supabaseClient
        .from("invitations")
        .select("token")
        .eq("id", existingInvite.id)
        .single();
      inviteToken = updated!.token;
    } else {
      const { data: newInvite, error: inviteError } = await supabaseClient
        .from("invitations")
        .insert({
          church_id: churchId,
          invited_by: user.id,
          email,
          role,
          ministry_id: ministryId || null,
        })
        .select("token")
        .single();

      if (inviteError) {
        logStep("Error creating invitation", { error: inviteError });
        throw new Error("Erro ao criar convite");
      }
      inviteToken = newInvite.token;
    }

    logStep("Invitation token generated", { token: inviteToken });

    const appUrl = req.headers.get("origin") || "https://sirvo.app";
    const inviteLink = `${appUrl}/convite/${inviteToken}`;

    const roleLabels: Record<string, string> = {
      admin: "Administrador",
      ministry_leader: "Líder de Ministério",
      volunteer: "Voluntário",
    };

    // Send via Lovable Emails queue (retry-safe, managed DKIM/SPF)
    // Forward the caller's JWT — send-transactional-email has verify_jwt=true
    // and the signing-keys gateway rejects service-role tokens.
    const { error: sendError } = await supabaseClient.functions.invoke(
      "send-transactional-email",
      {
        headers: { Authorization: authHeader },
        body: {
          templateName: "church-invitation",
          recipientEmail: email,
          idempotencyKey: resend ? `invite-${inviteToken}-r${Date.now()}` : `invite-${inviteToken}`,
          templateData: {
            churchName,
            inviterName,
            roleLabel: roleLabels[role] ?? "Voluntário",
            inviteUrl: inviteLink,
          },
        },
      }
    );

    if (sendError) {
      logStep("Error enqueueing invite email", { error: sendError });
      throw new Error("Erro ao enviar email do convite");
    }

    logStep("Invite email enqueued successfully", { email });

    return new Response(
      JSON.stringify({ success: true, message: "Convite enviado com sucesso" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in send-invite", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
