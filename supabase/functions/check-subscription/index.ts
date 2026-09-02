import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Product IDs for subscription plans
const PRODUCT_IDS = {
  basic: "prod_TZyl2yFHQOUsym", // 5 users
  standard: "prod_TZyqLTOzuAEdFV", // 10 users
};

const PLAN_LIMITS = {
  free: 3,
  basic: 10,
  standard: 30,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { churchId } = await req.json().catch(() => ({}));

    // Owner email has unlimited access
    const OWNER_EMAIL = "tiagotalmud@gmail.com";
    if (user.email === OWNER_EMAIL) {
      logStep("Owner account detected, granting unlimited access");
      return new Response(JSON.stringify({
        subscribed: true,
        plan: "unlimited",
        max_users: 999999,
        is_owner: true
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found, returning free plan");
      return new Response(JSON.stringify({ 
        subscribed: false,
        plan: "free",
        max_users: PLAN_LIMITS.free
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      logStep("No active subscription found");
      return new Response(JSON.stringify({ 
        subscribed: false,
        plan: "free",
        max_users: PLAN_LIMITS.free
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const subscription = subscriptions.data[0];
    const productId = subscription.items.data[0].price.product as string;
    const subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
    
    logStep("Active subscription found", { productId, subscriptionEnd });

    // Determine plan based on product ID
    let plan: "free" | "basic" | "standard" = "free";
    if (productId === PRODUCT_IDS.basic) {
      plan = "basic";
    } else if (productId === PRODUCT_IDS.standard) {
      plan = "standard";
    }

    const maxUsers = PLAN_LIMITS[plan];
    logStep("Determined plan", { plan, maxUsers });

    // Update church subscription in database if churchId provided
    if (churchId) {
      const { error: updateError } = await supabaseClient
        .from("church_subscriptions")
        .upsert({
          church_id: churchId,
          plan: plan,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          max_users: maxUsers,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: subscriptionEnd,
          status: subscription.status,
        }, { onConflict: "church_id" });

      if (updateError) {
        logStep("Error updating subscription", { error: updateError.message });
      } else {
        logStep("Church subscription updated in database");
      }
    }

    return new Response(JSON.stringify({
      subscribed: true,
      plan: plan,
      max_users: maxUsers,
      subscription_end: subscriptionEnd,
      stripe_subscription_id: subscription.id
    }), {
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
