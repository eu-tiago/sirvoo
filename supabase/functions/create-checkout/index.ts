import { canManageChurch } from "../_shared/authorization.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

// Price IDs for subscription plans
const PRICE_IDS = {
  basic: "price_1SconzR22UuVVE7TxdnVsUcl", // R$29.90/month - 5 users
  standard: "price_1ScosyR22UuVVE7TcS70lPb4", // R$59.90/month - 10 users
  premium: Deno.env.get("STRIPE_PRICE_PREMIUM") ?? "",
  unlimited: Deno.env.get("STRIPE_PRICE_UNLIMITED") ?? "",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const { plan, churchId } = await req.json();
    logStep("Request received", { plan, churchId });

    if (!plan || !PRICE_IDS[plan as keyof typeof PRICE_IDS]) {
      throw new Error("Invalid plan selected");
    }

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    if (!churchId || !(await canManageChurch(req, churchId))) {
      return new Response(JSON.stringify({ error: "Sem permiss?o nesta igreja" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2025-08-27.basil" 
    });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: subscription, error: subscriptionError } = await admin.from("church_subscriptions")
      .select("stripe_customer_id").eq("church_id", churchId).single();
    if (subscriptionError) throw subscriptionError;
    let customerId = subscription.stripe_customer_id;
    if (customerId) {
      const { count, error } = await admin.from("church_subscriptions")
        .select("church_id", { count: "exact", head: true }).eq("stripe_customer_id", customerId);
      if (error || count !== 1) throw new Error("Vínculo financeiro precisa ser revisado pelo Admin Master");
    }
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, metadata: { church_id: churchId } }, { idempotencyKey: `church-customer-${churchId}` });
      customerId = customer.id;
      const { error } = await admin.from("church_subscriptions").update({ stripe_customer_id: customerId }).eq("church_id", churchId);
      if (error) throw error;
    }

    const priceId = PRICE_IDS[plan as keyof typeof PRICE_IDS];
    logStep("Creating checkout session", { priceId, plan });

    const baseUrl = "https://sirvo.app";
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      subscription_data: { metadata: { church_id: churchId, plan } },
      success_url: `${baseUrl}/dashboard?subscription=success&plan=${plan}`,
      cancel_url: `${baseUrl}/pricing?subscription=canceled`,
      metadata: {
        church_id: churchId,
        user_id: user.id,
        plan: plan,
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
