import { callerPermission } from "../_shared/authorization.ts";
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
  ministryIds?: string[];
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

    const { email, fullName, role, churchId, ministryIds = [] }: CreateUserRequest = await req.json();
    if (!churchId || !["admin", "ministry_leader", "volunteer"].includes(role)) throw new Error("Dados inv?lidos");
    if (!(await callerPermission(req, "can_create_church_user", { _church_id: churchId, _role: role, _ministries: ministryIds }))) {
      return new Response(JSON.stringify({ error: "Sem permiss?o nesta igreja" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


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

    // Existing accounts must accept an invitation; never attach them by mutable profile email.
    const normalizedEmail = email.trim().toLowerCase();
    const { data: existingProfile } = await supabaseAdmin.from("profiles").select("id").eq("email", normalizedEmail).maybeSingle();
    if (existingProfile) {
      return new Response(JSON.stringify({ error: "Utilize um convite para vincular uma conta existente." }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create new user via Admin API
    const tempPassword = crypto.randomUUID().slice(0, 12);
    
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
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

    // Membership, ministry links and the temporary-password flag commit together.
    const { error: memberError } = await supabaseAdmin.rpc("provision_church_user", {
      _caller: user.id, _user_id: newUser.user.id, _church_id: churchId,
      _role: role, _ministries: ministryIds,
    });
    if (memberError) {
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      throw memberError;
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
