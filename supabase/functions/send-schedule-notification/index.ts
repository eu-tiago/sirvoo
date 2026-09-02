import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScheduleEvent {
  title: string;
  event_date: string;
  start_time: string;
}

interface ScheduleMinistry {
  name: string;
}

interface ScheduleData {
  id: string;
  event: ScheduleEvent;
  ministry: ScheduleMinistry;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Require authenticated caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const callerId = claimsData.claims.sub as string;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { schedule_id, action, user_ids } = body ?? {};

    console.log("Processing notification for schedule:", schedule_id, "action:", action);

    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const allowedActions = new Set([
      "assigned", "published", "updated", "reminder", "substitution_needed",
    ]);

    if (typeof schedule_id !== "string" || !uuidRe.test(schedule_id) ||
        typeof action !== "string" || !allowedActions.has(action)) {
      return new Response(
        JSON.stringify({ error: "Invalid schedule_id or action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authorization: caller must be a member of the schedule's ministry church
    const { data: scheduleRow } = await supabase
      .from("schedules")
      .select("ministry_id, ministries!inner(church_id)")
      .eq("id", schedule_id)
      .single();
    const scheduleChurchId = (scheduleRow as any)?.ministries?.church_id;
    if (!scheduleChurchId) {
      return new Response(
        JSON.stringify({ error: "Schedule not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { data: callerMembership } = await supabase
      .from("church_members")
      .select("id")
      .eq("church_id", scheduleChurchId)
      .eq("user_id", callerId)
      .maybeSingle();
    if (!callerMembership) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get schedule details with event and ministry info
    const { data: scheduleData, error: scheduleError } = await supabase
      .from("schedules")
      .select(`
        id,
        event:events!inner(title, event_date, start_time),
        ministry:ministries!inner(name)
      `)
      .eq("id", schedule_id)
      .single();

    if (scheduleError || !scheduleData) {
      console.error("Error fetching schedule:", scheduleError);
      return new Response(
        JSON.stringify({ error: "Schedule not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const schedule = scheduleData as unknown as ScheduleData;

    let targetUserIds: string[] = user_ids || [];
    let notificationTitle = "";
    let notificationMessage = "";
    let notificationType = "schedule";

    // If no specific user_ids provided, get all assigned users
    if (targetUserIds.length === 0 && action !== "assigned") {
      const { data: assignments } = await supabase
        .from("schedule_assignments")
        .select("user_id")
        .eq("schedule_id", schedule_id);

      targetUserIds = assignments?.map((a: { user_id: string }) => a.user_id) || [];
    }

    // Determine notification content based on action
    switch (action) {
      case "assigned":
        notificationTitle = "Nova Escala";
        notificationMessage = `Você foi escalado para ${schedule.event.title} em ${schedule.ministry.name}`;
        notificationType = "schedule";
        break;
      case "published":
        notificationTitle = "Escala Publicada";
        notificationMessage = `A escala para ${schedule.event.title} foi publicada`;
        notificationType = "schedule";
        break;
      case "updated":
        notificationTitle = "Escala Atualizada";
        notificationMessage = `A escala para ${schedule.event.title} foi modificada`;
        notificationType = "alert";
        break;
      case "reminder":
        notificationTitle = "Lembrete de Escala";
        notificationMessage = `Você está escalado amanhã para ${schedule.event.title}`;
        notificationType = "reminder";
        break;
      case "substitution_needed":
        notificationTitle = "Substituição Necessária";
        notificationMessage = `Precisamos de voluntário para ${schedule.event.title}`;
        notificationType = "alert";
        break;
      default:
        notificationTitle = "Notificação de Escala";
        notificationMessage = `Atualização na escala de ${schedule.event.title}`;
    }

    // Send notifications to all target users
    const notifications = targetUserIds.map((userId: string) => ({
      user_id: userId,
      title: notificationTitle,
      message: notificationMessage,
      type: notificationType,
      related_schedule_id: schedule_id,
    }));

    if (notifications.length > 0) {
      const { error: insertError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (insertError) {
        console.error("Error inserting notifications:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to send notifications" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Successfully sent ${notifications.length} notifications`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: notifications.length,
        action,
        schedule_id 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in send-schedule-notification:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});