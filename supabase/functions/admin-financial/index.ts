import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPERADMIN_EMAIL = "tiagotalmud@gmail.com";

const PRODUCT_IDS = {
  basic: "prod_TZyl2yFHQOUsym",
  standard: "prod_TZyqLTOzuAEdFV",
};

const PLAN_LIMITS: Record<string, number> = {
  free: 3,
  basic: 10,
  standard: 30,
  unlimited: 999999,
};

const PLAN_PRICES: Record<string, number> = {
  free: 0,
  basic: 29.9,
  standard: 59.9,
};

const log = (s: string, d?: any) =>
  console.log(`[ADMIN-FINANCIAL] ${s}${d ? " - " + JSON.stringify(d) : ""}`);

// Safely convert any unix timestamp (seconds) to ISO string, or null
function tsToISO(ts: unknown): string | null {
  if (ts === null || ts === undefined) return null;
  const n = typeof ts === "number" ? ts : Number(ts);
  if (!Number.isFinite(n) || n <= 0) return null;
  try {
    const d = new Date(n * 1000);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr) throw new Error(userErr.message);
    const user = userData.user;
    if (!user?.email || user.email.toLowerCase() !== SUPERADMIN_EMAIL.toLowerCase()) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "overview";
    log("Action", { action });

    // ---------- ACTIONS ----------
    if (action === "manual_override") {
      const { churchId, plan, maxUsers } = body;
      if (!churchId || !plan) throw new Error("churchId and plan required");
      const max = maxUsers ?? PLAN_LIMITS[plan] ?? 3;
      const { error } = await supabase
        .from("church_subscriptions")
        .upsert(
          {
            church_id: churchId,
            plan,
            max_users: max,
            status: plan === "free" ? "canceled" : "active",
            current_period_end: plan === "free"
              ? null
              : new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
          },
          { onConflict: "church_id" }
        );
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "sync_church") {
      const { churchId } = body;
      if (!churchId) throw new Error("churchId required");
      const { data: members } = await supabase
        .from("church_members")
        .select("user_id")
        .eq("church_id", churchId)
        .eq("role", "admin")
        .limit(1);
      if (!members?.length) throw new Error("No admin found");
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", members[0].user_id)
        .single();
      if (!profile?.email) throw new Error("Admin email not found");

      const customers = await stripe.customers.list({ email: profile.email, limit: 1 });
      if (!customers.data.length) {
        await supabase
          .from("church_subscriptions")
          .upsert(
            { church_id: churchId, plan: "free", max_users: 3, status: "canceled" },
            { onConflict: "church_id" }
          );
        return new Response(JSON.stringify({ success: true, plan: "free" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const subs = await stripe.subscriptions.list({
        customer: customers.data[0].id,
        status: "all",
        limit: 1,
      });
      let plan: "free" | "basic" | "standard" = "free";
      let subEnd: string | null = null;
      let subId: string | null = null;
      let status = "canceled";
      if (subs.data.length) {
        const s = subs.data[0];
        const pid = s.items.data[0].price.product as string;
        if (pid === PRODUCT_IDS.basic) plan = "basic";
        else if (pid === PRODUCT_IDS.standard) plan = "standard";
        subEnd = tsToISO((s as any).current_period_end);
        subId = s.id;
        status = s.status;
      }
      await supabase.from("church_subscriptions").upsert(
        {
          church_id: churchId,
          plan,
          max_users: PLAN_LIMITS[plan],
          stripe_customer_id: customers.data[0].id,
          stripe_subscription_id: subId,
          current_period_end: subEnd,
          status,
        },
        { onConflict: "church_id" }
      );
      return new Response(JSON.stringify({ success: true, plan, status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_invoices") {
      const { churchId } = body;
      const { data: sub } = await supabase
        .from("church_subscriptions")
        .select("stripe_customer_id")
        .eq("church_id", churchId)
        .single();
      if (!sub?.stripe_customer_id) {
        return new Response(JSON.stringify({ invoices: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const invoices = await stripe.invoices.list({
        customer: sub.stripe_customer_id,
        limit: 30,
      });
      return new Response(
        JSON.stringify({
          invoices: invoices.data.map((i) => ({
            id: i.id,
            amount_paid: (i.amount_paid ?? 0) / 100,
            amount_due: (i.amount_due ?? 0) / 100,
            currency: i.currency,
            status: i.status,
            created: i.created,
            due_date: i.due_date,
            period_start: (i as any).period_start,
            period_end: (i as any).period_end,
            attempt_count: (i as any).attempt_count ?? 0,
            next_payment_attempt: (i as any).next_payment_attempt,
            hosted_invoice_url: i.hosted_invoice_url,
            invoice_pdf: i.invoice_pdf,
            number: i.number,
          })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "list_payments") {
      // All recent payment intents / charges across the account
      const { limit = 50 } = body;
      const charges = await stripe.charges.list({ limit: Math.min(limit, 100) });
      // Map customer -> church
      const { data: subs } = await supabase
        .from("church_subscriptions")
        .select("church_id, stripe_customer_id, churches(name)");
      const custToChurch = new Map<string, { id: string; name: string }>();
      for (const s of subs ?? []) {
        if (s.stripe_customer_id) {
          custToChurch.set(s.stripe_customer_id, {
            id: s.church_id,
            name: (s as any).churches?.name ?? "—",
          });
        }
      }
      return new Response(
        JSON.stringify({
          payments: charges.data.map((c) => {
            const ch = typeof c.customer === "string" ? custToChurch.get(c.customer) : null;
            return {
              id: c.id,
              amount: c.amount / 100,
              currency: c.currency,
              status: c.status,
              paid: c.paid,
              refunded: c.refunded,
              created: c.created,
              receipt_url: c.receipt_url,
              description: c.description,
              failure_message: c.failure_message,
              customer_id: c.customer,
              church_id: ch?.id ?? null,
              church_name: ch?.name ?? "—",
              card_brand: (c.payment_method_details as any)?.card?.brand ?? null,
              card_last4: (c.payment_method_details as any)?.card?.last4 ?? null,
            };
          }),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---------- OVERVIEW (default) ----------
    const { data: churches } = await supabase
      .from("churches")
      .select("id, name, created_at, created_by")
      .order("created_at", { ascending: false });

    const { data: subs } = await supabase
      .from("church_subscriptions")
      .select("*");

    const subMap = new Map((subs ?? []).map((s) => [s.church_id, s]));

    // Get admin emails
    const adminMap = new Map<string, { name: string; email: string }>();
    if (churches?.length) {
      const { data: members } = await supabase
        .from("church_members")
        .select("church_id, user_id")
        .eq("role", "admin")
        .in("church_id", churches.map((c) => c.id));
      const userIds = [...new Set((members ?? []).map((m) => m.user_id))];
      if (userIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .in("id", userIds);
        const profMap = new Map((profiles ?? []).map((p) => [p.id, p]));
        for (const m of members ?? []) {
          const p = profMap.get(m.user_id);
          if (p && !adminMap.has(m.church_id)) {
            adminMap.set(m.church_id, {
              name: p.full_name ?? "—",
              email: p.email ?? "—",
            });
          }
        }
      }
    }

    // User counts
    const userCountMap = new Map<string, number>();
    if (churches?.length) {
      const { data: counts } = await supabase
        .from("church_members")
        .select("church_id")
        .in("church_id", churches.map((c) => c.id));
      for (const r of counts ?? []) {
        userCountMap.set(r.church_id, (userCountMap.get(r.church_id) ?? 0) + 1);
      }
    }

    // Fetch live Stripe data for each customer to detect overdue/past_due/last payment
    const stripeInfoMap = new Map<
      string,
      {
        live_status: string | null;
        last_invoice_status: string | null;
        last_payment_at: number | null;
        next_payment_attempt: number | null;
        amount_due: number;
        cancel_at_period_end: boolean;
      }
    >();

    const customerIds = (subs ?? [])
      .map((s) => s.stripe_customer_id)
      .filter(Boolean) as string[];

    // Limit live calls — fetch up to 50 customers in parallel
    const toFetch = customerIds.slice(0, 50);
    await Promise.all(
      toFetch.map(async (cid) => {
        try {
          const [liveSubs, invs] = await Promise.all([
            stripe.subscriptions.list({ customer: cid, status: "all", limit: 1 }),
            stripe.invoices.list({ customer: cid, limit: 1 }),
          ]);
          const ls = liveSubs.data[0];
          const inv = invs.data[0];
          stripeInfoMap.set(cid, {
            live_status: ls?.status ?? null,
            last_invoice_status: inv?.status ?? null,
            last_payment_at: inv?.status === "paid" ? inv.created : null,
            next_payment_attempt: (inv as any)?.next_payment_attempt ?? null,
            amount_due: ((inv?.amount_due ?? 0) - (inv?.amount_paid ?? 0)) / 100,
            cancel_at_period_end: (ls as any)?.cancel_at_period_end ?? false,
          });
        } catch (e) {
          log("Stripe per-customer error", { cid, e: String(e) });
        }
      })
    );

    const rows = (churches ?? []).map((c) => {
      const s = subMap.get(c.id);
      const admin = adminMap.get(c.id);
      const stripeInfo = s?.stripe_customer_id ? stripeInfoMap.get(s.stripe_customer_id) : null;

      // Compute payment_status
      const plan = s?.plan ?? "free";
      const liveStatus = stripeInfo?.live_status ?? s?.status ?? "active";
      let paymentStatus: "paid" | "past_due" | "unpaid" | "canceled" | "trialing" | "free" = "free";
      if (plan === "free") paymentStatus = "free";
      else if (liveStatus === "active") paymentStatus = "paid";
      else if (liveStatus === "past_due") paymentStatus = "past_due";
      else if (liveStatus === "unpaid") paymentStatus = "unpaid";
      else if (liveStatus === "trialing") paymentStatus = "trialing";
      else if (liveStatus === "canceled") paymentStatus = "canceled";

      return {
        church_id: c.id,
        church_name: c.name,
        created_at: c.created_at,
        admin_name: admin?.name ?? "—",
        admin_email: admin?.email ?? "—",
        plan,
        max_users: s?.max_users ?? 3,
        current_users: userCountMap.get(c.id) ?? 0,
        status: s?.status ?? "active",
        live_status: liveStatus,
        payment_status: paymentStatus,
        last_invoice_status: stripeInfo?.last_invoice_status ?? null,
        last_payment_at: stripeInfo?.last_payment_at ?? null,
        next_payment_attempt: stripeInfo?.next_payment_attempt ?? null,
        amount_due: stripeInfo?.amount_due ?? 0,
        cancel_at_period_end: stripeInfo?.cancel_at_period_end ?? false,
        current_period_end: s?.current_period_end ?? null,
        stripe_customer_id: s?.stripe_customer_id ?? null,
        stripe_subscription_id: s?.stripe_subscription_id ?? null,
      };
    });

    // KPIs
    const activePaying = rows.filter(
      (r) => (r.plan === "basic" || r.plan === "standard") && r.payment_status === "paid"
    );
    const pastDue = rows.filter((r) => r.payment_status === "past_due" || r.payment_status === "unpaid");
    const mrr = activePaying.reduce((acc, r) => acc + (PLAN_PRICES[r.plan] ?? 0), 0);
    const overdueAmount = rows.reduce((acc, r) => acc + (r.amount_due > 0 ? r.amount_due : 0), 0);

    // Stripe revenue this month
    const now = new Date();
    const firstOfMonth = Math.floor(
      new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000
    );
    let monthRevenue = 0;
    let monthInvoices = 0;
    let failedThisMonth = 0;
    let churnCount = 0;
    try {
      const charges = await stripe.charges.list({
        created: { gte: firstOfMonth },
        limit: 100,
      });
      for (const ch of charges.data) {
        if (ch.paid && !ch.refunded) {
          monthRevenue += ch.amount / 100;
          monthInvoices++;
        }
        if (ch.status === "failed") failedThisMonth++;
      }
      const canceled = await stripe.subscriptions.list({
        status: "canceled",
        limit: 100,
      });
      churnCount = canceled.data.filter(
        (s) => s.canceled_at && s.canceled_at >= firstOfMonth
      ).length;
    } catch (e) {
      log("Stripe fetch error", { error: String(e) });
    }

    return new Response(
      JSON.stringify({
        kpis: {
          mrr,
          active_subscribers: activePaying.length,
          past_due_count: pastDue.length,
          overdue_amount: overdueAmount,
          month_revenue: monthRevenue,
          month_invoices: monthInvoices,
          failed_this_month: failedThisMonth,
          churn: churnCount,
          plan_breakdown: {
            free: rows.filter((r) => r.plan === "free").length,
            basic: rows.filter((r) => r.plan === "basic").length,
            standard: rows.filter((r) => r.plan === "standard").length,
          },
        },
        churches: rows,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
