import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ACCEPT-INVITE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const { inviteToken } = await req.json();
    if (!inviteToken) throw new Error("Token de convite não fornecido");
    logStep("Processing invite token", { inviteToken });

    // Fetch invitation using service role (bypasses RLS)
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from("invitations")
      .select("*, churches(name)")
      .eq("token", inviteToken)
      .single();

    if (inviteError || !invitation) {
      logStep("Invitation not found", { error: inviteError });
      return new Response(
        JSON.stringify({ error: "Convite não encontrado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Check expiration
    if (new Date(invitation.expires_at) < new Date()) {
      await supabaseAdmin
        .from("invitations")
        .update({ status: "expired" })
        .eq("id", invitation.id);

      return new Response(
        JSON.stringify({ error: "Este convite expirou. Peça um novo convite ao administrador." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 410 }
      );
    }

    // Check if already accepted
    if (invitation.status === "accepted") {
      return new Response(
        JSON.stringify({ error: "Este convite já foi aceito", alreadyAccepted: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (invitation.status === "expired") {
      return new Response(
        JSON.stringify({ error: "Este convite expirou. Peça um novo convite ao administrador." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 410 }
      );
    }

    // Ensure invitation email matches logged-in user
    const userEmail = (user.email ?? "").trim().toLowerCase();
    const inviteEmail = (invitation.email ?? "").trim().toLowerCase();
    if (userEmail && inviteEmail && userEmail !== inviteEmail) {
      logStep("Email mismatch", { userEmail, inviteEmail });
      return new Response(
        JSON.stringify({
          error: `Este convite é para ${invitation.email}. Faça login com esse email para aceitar.`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // Check if user is already a member of this church
    const { data: existingMember } = await supabaseAdmin
      .from("church_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("church_id", invitation.church_id)
      .maybeSingle();

    if (existingMember) {
      // Mark invite as accepted anyway
      await supabaseAdmin
        .from("invitations")
        .update({ status: "accepted", accepted_by: user.id, accepted_at: new Date().toISOString() })
        .eq("id", invitation.id);

      return new Response(
        JSON.stringify({ success: true, message: "Você já é membro desta igreja", churchId: invitation.church_id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Add user to church
    const { error: memberError } = await supabaseAdmin
      .from("church_members")
      .insert({
        user_id: user.id,
        church_id: invitation.church_id,
        role: invitation.role,
      });

    if (memberError) {
      logStep("Error adding user to church", { error: memberError });
      throw new Error("Erro ao vincular usuário à igreja");
    }

    logStep("User added to church", { churchId: invitation.church_id, role: invitation.role });

    // Update user_roles
    await supabaseAdmin
      .from("user_roles")
      .update({ role: invitation.role })
      .eq("user_id", user.id);

    // Add to ministry if specified
    if (invitation.ministry_id) {
      const { error: ministryError } = await supabaseAdmin
        .from("ministry_members")
        .insert({
          user_id: user.id,
          ministry_id: invitation.ministry_id,
          is_leader: invitation.role === "ministry_leader",
        });

      if (ministryError) {
        logStep("Error adding to ministry (non-critical)", { error: ministryError });
      } else {
        logStep("User added to ministry", { ministryId: invitation.ministry_id });
      }
    }

    // Mark invitation as accepted
    await supabaseAdmin
      .from("invitations")
      .update({
        status: "accepted",
        accepted_by: user.id,
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    logStep("Invitation accepted successfully");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Convite aceito com sucesso!",
        churchId: invitation.church_id,
        churchName: invitation.churches?.name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in accept-invite", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
