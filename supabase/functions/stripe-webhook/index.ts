import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

// Product IDs for subscription plans
const PRODUCT_IDS = {
  basic: "prod_TZyl2yFHQOUsym", // 10 users
  standard: "prod_TZyqLTOzuAEdFV", // 30 users
};

const PLAN_LIMITS: Record<string, { plan: string; maxUsers: number }> = {
  [PRODUCT_IDS.basic]: { plan: "basic", maxUsers: 10 },
  [PRODUCT_IDS.standard]: { plan: "standard", maxUsers: 30 },
};

const FREE_PLAN = { plan: "free", maxUsers: 3 };

// Safely convert a Stripe UNIX timestamp (seconds) to ISO string.
// Returns null if the value is missing or invalid - never throws.
function safeStripeDateISO(timestamp: unknown): string | null {
  try {
    if (timestamp === null || timestamp === undefined) return null;
    const num = typeof timestamp === "number" ? timestamp : Number(timestamp);
    if (!Number.isFinite(num) || num <= 0) return null;
    const date = new Date(num * 1000);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch (err) {
    logStep("WARN - safeStripeDateISO failed", { timestamp, error: (err as Error).message });
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!stripeKey || !webhookSecret) {
    logStep("ERROR - Missing Stripe configuration");
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  let event: Stripe.Event;

  try {
    const signature = req.headers.get("stripe-signature");
    if (!signature) throw new Error("No stripe-signature header found");

    const body = await req.text();

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err: any) {
      logStep("ERROR - Webhook signature verification failed", { error: err.message });
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Event received", { type: event.type, id: event.id });

    // ===== IDEMPOTENCY CHECK =====
    const { data: existing } = await supabase
      .from("stripe_webhook_events")
      .select("id, status")
      .eq("stripe_event_id", event.id)
      .maybeSingle();

    if (existing && existing.status === "processed") {
      logStep("Event already processed, skipping", { eventId: event.id });
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert/upsert as 'processing' before handling
    await supabase.from("stripe_webhook_events").upsert(
      {
        stripe_event_id: event.id,
        event_type: event.type,
        status: "processing",
        payload: event as any,
      },
      { onConflict: "stripe_event_id" }
    );

    // ===== EVENT HANDLERS =====
    try {
      switch (event.type) {
        case "checkout.session.completed":
          await handleCheckoutCompleted(supabase, stripe, event.data.object as Stripe.Checkout.Session);
          break;

        case "invoice.paid":
          await handleInvoicePaid(supabase, stripe, event.data.object as Stripe.Invoice);
          break;

        case "invoice.payment_failed":
          await handlePaymentFailed(supabase, event.data.object as Stripe.Invoice);
          break;

        case "customer.subscription.created":
        case "customer.subscription.updated":
          await handleSubscriptionChange(supabase, event.data.object as Stripe.Subscription);
          break;

        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(supabase, event.data.object as Stripe.Subscription);
          break;

        default:
          logStep("Unhandled event type", { type: event.type });
      }

      // Mark as successfully processed
      await supabase
        .from("stripe_webhook_events")
        .update({ status: "processed", processed_at: new Date().toISOString() })
        .eq("stripe_event_id", event.id);

      logStep("Event processed successfully", { id: event.id, type: event.type });
    } catch (handlerError: any) {
      logStep("ERROR in handler", { type: event.type, error: handlerError?.message, stack: handlerError?.stack });
      try {
        await supabase
          .from("stripe_webhook_events")
          .update({ status: "failed", error_message: String(handlerError?.message ?? handlerError) })
          .eq("stripe_event_id", event.id);
      } catch (logErr) {
        logStep("ERROR updating webhook event log", { error: (logErr as Error).message });
      }

      // Return 200 so Stripe does NOT retry indefinitely on bugs we've logged.
      // Idempotency table records the failure for debugging/manual replay.
      return new Response(JSON.stringify({ received: true, handler_error: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    logStep("ERROR", { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ============== HELPERS ==============

function planFromProductId(productId: string | null | undefined) {
  if (!productId) return FREE_PLAN;
  return PLAN_LIMITS[productId] || FREE_PLAN;
}

async function findChurchIdByCustomer(supabase: any, customerId: string): Promise<string | null> {
  const { data } = await supabase
    .from("church_subscriptions")
    .select("church_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.church_id ?? null;
}

async function notifyChurchAdmins(
  supabase: any,
  churchId: string,
  title: string,
  message: string,
  type: string = "info"
) {
  const { data: admins } = await supabase
    .from("church_members")
    .select("user_id")
    .eq("church_id", churchId)
    .eq("role", "admin");

  if (!admins?.length) return;

  for (const admin of admins) {
    await supabase.rpc("send_notification", {
      _user_id: admin.user_id,
      _title: title,
      _message: message,
      _type: type,
    });
  }
}

// ============== HANDLERS ==============

async function handleCheckoutCompleted(
  supabase: any,
  stripe: Stripe,
  session: Stripe.Checkout.Session
) {
  logStep("checkout.session.completed", { sessionId: session.id });

  const churchId = session.metadata?.church_id;
  const userId = session.metadata?.user_id;

  if (!churchId) {
    logStep("No church_id in metadata, skipping");
    return;
  }

  const subscriptionId = session.subscription as string | null;
  if (!subscriptionId) {
    logStep("No subscription ID in checkout session");
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const productId = subscription.items.data[0]?.price.product as string;
  const planInfo = planFromProductId(productId);

  const periodStart = safeStripeDateISO((subscription as any).current_period_start);
  const periodEnd = safeStripeDateISO((subscription as any).current_period_end);

  const upsertPayload: Record<string, unknown> = {
    church_id: churchId,
    plan: planInfo.plan,
    stripe_customer_id: session.customer as string,
    stripe_subscription_id: subscriptionId,
    max_users: planInfo.maxUsers,
    status: "active",
  };
  if (periodStart) upsertPayload.current_period_start = periodStart;
  if (periodEnd) upsertPayload.current_period_end = periodEnd;

  const { error } = await supabase
    .from("church_subscriptions")
    .upsert(upsertPayload, { onConflict: "church_id" });

  if (error) throw new Error(`DB upsert failed: ${error.message}`);
  logStep("Subscription activated via checkout", { churchId, plan: planInfo.plan });

  if (userId) {
    await supabase.rpc("send_notification", {
      _user_id: userId,
      _title: "Assinatura Ativada!",
      _message: `Seu plano ${planInfo.plan === "basic" ? "Básico" : "Standard"} foi ativado com sucesso.`,
      _type: "success",
    });
  }
}

async function handleInvoicePaid(supabase: any, stripe: Stripe, invoice: Stripe.Invoice) {
  logStep("invoice.paid", { invoiceId: invoice.id });

  const customerId = invoice.customer as string;
  const subscriptionId = invoice.subscription as string | null;

  const churchId = await findChurchIdByCustomer(supabase, customerId);
  if (!churchId) {
    logStep("No church found for customer", { customerId });
    return;
  }

  // Fetch latest subscription state to keep dates fresh
  let updates: any = { status: "active" };

  if (subscriptionId) {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    const productId = sub.items.data[0]?.price.product as string;
    const planInfo = planFromProductId(productId);
    const periodStart = safeStripeDateISO((sub as any).current_period_start);
    const periodEnd = safeStripeDateISO((sub as any).current_period_end);
    updates = {
      ...updates,
      plan: planInfo.plan,
      max_users: planInfo.maxUsers,
      stripe_subscription_id: sub.id,
    };
    if (periodStart) updates.current_period_start = periodStart;
    if (periodEnd) updates.current_period_end = periodEnd;
  }

  const { error } = await supabase
    .from("church_subscriptions")
    .update(updates)
    .eq("church_id", churchId);

  if (error) throw new Error(`DB update failed: ${error.message}`);
  logStep("Subscription marked active after payment", { churchId });
}

async function handlePaymentFailed(supabase: any, invoice: Stripe.Invoice) {
  logStep("invoice.payment_failed", { invoiceId: invoice.id });

  const customerId = invoice.customer as string;
  const churchId = await findChurchIdByCustomer(supabase, customerId);
  if (!churchId) {
    logStep("No church found for customer", { customerId });
    return;
  }

  const { error } = await supabase
    .from("church_subscriptions")
    .update({ status: "past_due" })
    .eq("church_id", churchId);

  if (error) throw new Error(`DB update failed: ${error.message}`);

  await notifyChurchAdmins(
    supabase,
    churchId,
    "Pagamento Falhou",
    "Houve um problema com o pagamento da sua assinatura. Atualize seus dados de pagamento para evitar a suspensão do acesso.",
    "alert"
  );

  logStep("Subscription marked past_due", { churchId });
}

async function handleSubscriptionChange(supabase: any, subscription: Stripe.Subscription) {
  logStep("subscription change", { id: subscription.id, status: subscription.status });

  const customerId = subscription.customer as string;
  const churchId = await findChurchIdByCustomer(supabase, customerId);
  if (!churchId) {
    logStep("No church found for customer", { customerId });
    return;
  }

  const productId = subscription.items.data[0]?.price.product as string;
  const planInfo = planFromProductId(productId);

  // Map Stripe status to internal status
  let internalStatus = subscription.status;
  if (subscription.cancel_at_period_end) {
    internalStatus = "canceling";
  }

  const periodStart = safeStripeDateISO((subscription as any).current_period_start);
  const periodEnd = safeStripeDateISO((subscription as any).current_period_end);

  const updatePayload: Record<string, unknown> = {
    plan: planInfo.plan,
    stripe_subscription_id: subscription.id,
    max_users: planInfo.maxUsers,
    status: internalStatus,
  };
  if (periodStart) updatePayload.current_period_start = periodStart;
  if (periodEnd) updatePayload.current_period_end = periodEnd;

  const { error } = await supabase
    .from("church_subscriptions")
    .update(updatePayload)
    .eq("church_id", churchId);

  if (error) throw new Error(`DB update failed: ${error.message}`);
  logStep("Subscription updated", { churchId, plan: planInfo.plan, status: internalStatus });
}

async function handleSubscriptionDeleted(supabase: any, subscription: Stripe.Subscription) {
  logStep("subscription.deleted", { id: subscription.id });

  const customerId = subscription.customer as string;
  const churchId = await findChurchIdByCustomer(supabase, customerId);
  if (!churchId) {
    logStep("No church found for customer", { customerId });
    return;
  }

  const { error } = await supabase
    .from("church_subscriptions")
    .update({
      plan: FREE_PLAN.plan,
      max_users: FREE_PLAN.maxUsers,
      stripe_subscription_id: null,
      current_period_start: null,
      current_period_end: null,
      status: "canceled",
    })
    .eq("church_id", churchId);

  if (error) throw new Error(`DB update failed: ${error.message}`);

  await notifyChurchAdmins(
    supabase,
    churchId,
    "Assinatura Cancelada",
    "Sua assinatura foi cancelada e a igreja voltou para o plano Gratuito (3 usuários).",
    "alert"
  );

  logStep("Subscription canceled, downgraded to free", { churchId });
}
