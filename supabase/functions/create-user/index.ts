import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-USER] ${step}${detailsStr}`);
};

interface CreateUserRequest {
  email: string;
  fullName: string;
  role: "admin" | "ministry_leader" | "volunteer";
  churchId: string;
}

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

    const { email, fullName, role, churchId }: CreateUserRequest = await req.json();
    logStep("Create user request received", { email, role, churchId });

    // Check if user can add more users (subscription limit)
    const { data: canAdd, error: canAddError } = await supabaseAdmin
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

    // Check if email already exists (case-insensitive)
    const normalizedEmail = email.trim().toLowerCase();
    let { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    // Fallback: user may exist in auth without a profile row
    if (!existingProfile) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const authUser = list?.users?.find(
        (u: any) => (u.email ?? "").toLowerCase() === normalizedEmail
      );
      if (authUser) {
        await supabaseAdmin
          .from("profiles")
          .upsert({ id: authUser.id, email: normalizedEmail, full_name: fullName }, { onConflict: "id" });
        existingProfile = { id: authUser.id };
      }
    }


    if (existingProfile) {
      // Check if already a member of this church
      const { data: existingMember } = await supabaseAdmin
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

      // Add existing user to church
      const { error: memberError } = await supabaseAdmin
        .from("church_members")
        .insert({
          user_id: existingProfile.id,
          church_id: churchId,
          role: role,
        });

      if (memberError) throw memberError;

      logStep("Existing user added to church", { userId: existingProfile.id });

      return new Response(
        JSON.stringify({ success: true, message: "Usuário existente adicionado à igreja", userId: existingProfile.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Create new user via Admin API
    const tempPassword = crypto.randomUUID().slice(0, 12);
    
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (createError) {
      logStep("Error creating user", { error: createError });
      throw new Error(`Erro ao criar usuário: ${createError.message}`);
    }

    if (!newUser.user) {
      throw new Error("Erro ao criar usuário");
    }

    logStep("User created", { userId: newUser.user.id });

    // Add user to church
    const { error: memberError } = await supabaseAdmin
      .from("church_members")
      .insert({
        user_id: newUser.user.id,
        church_id: churchId,
        role: role,
      });

    if (memberError) {
      logStep("Error adding user to church", { error: memberError });
      throw memberError;
    }

    // Update user_roles
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .update({ role: role })
      .eq("user_id", newUser.user.id);

    if (roleError) {
      logStep("Error updating user role", { error: roleError });
    }

    logStep("User created and added to church successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Usuário criado com sucesso",
        userId: newUser.user.id,
        tempPassword: tempPassword
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-user", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
