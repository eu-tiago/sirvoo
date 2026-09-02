import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { token } = await req.json();
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token não fornecido" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { data: invitation, error } = await supabaseAdmin
      .from("invitations")
      .select("email, role, status, expires_at, church_id, invited_by, churches(name)")
      .eq("token", token)
      .single();

    if (error || !invitation) {
      return new Response(
        JSON.stringify({ error: "Convite não encontrado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Get inviter name
    const { data: inviterProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", invitation.invited_by)
      .maybeSingle();

    const expired = new Date(invitation.expires_at) < new Date();

    return new Response(
      JSON.stringify({
        churchName: (invitation as any).churches?.name || "Igreja",
        inviterName: inviterProfile?.full_name || "Um administrador",
        role: invitation.role,
        email: invitation.email,
        expired,
        status: expired ? "expired" : invitation.status,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
