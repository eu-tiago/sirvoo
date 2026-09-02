import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all pending reminders that are due
    const { data: reminders, error: fetchError } = await supabase
      .from('schedule_reminders')
      .select(`
        id,
        user_id,
        schedule_id,
        event_id,
        reminder_type,
        assignment_id
      `)
      .eq('sent', false)
      .lte('remind_at', new Date().toISOString())
      .limit(100);

    if (fetchError) throw fetchError;

    if (!reminders || reminders.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending reminders', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${reminders.length} reminders`);

    let sentCount = 0;
    let skippedCount = 0;

    for (const reminder of reminders) {
      try {
        // Check if user still has an active assignment
        const { data: assignment } = await supabase
          .from('schedule_assignments')
          .select('id, status')
          .eq('id', reminder.assignment_id)
          .maybeSingle();

        if (!assignment || assignment.status === 'rejected' || assignment.status === 'cancelled') {
          // Assignment was removed/cancelled, mark reminder as sent to skip it
          await supabase
            .from('schedule_reminders')
            .update({ sent: true, sent_at: new Date().toISOString() })
            .eq('id', reminder.id);
          skippedCount++;
          continue;
        }

        // Check if user has reminders enabled
        const { data: profile } = await supabase
          .from('profiles')
          .select('reminders_enabled, full_name')
          .eq('id', reminder.user_id)
          .maybeSingle();

        if (profile && profile.reminders_enabled === false) {
          await supabase
            .from('schedule_reminders')
            .update({ sent: true, sent_at: new Date().toISOString() })
            .eq('id', reminder.id);
          skippedCount++;
          continue;
        }

        // Get event details
        const { data: event } = await supabase
          .from('events')
          .select('title, event_date, start_time')
          .eq('id', reminder.event_id)
          .maybeSingle();

        if (!event) {
          await supabase
            .from('schedule_reminders')
            .update({ sent: true, sent_at: new Date().toISOString() })
            .eq('id', reminder.id);
          skippedCount++;
          continue;
        }

        // Build notification message
        const eventDate = new Date(event.event_date + 'T00:00:00');
        const formattedDate = eventDate.toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        });
        const formattedTime = event.start_time?.substring(0, 5) || '';

        let title = '';
        let message = '';

        switch (reminder.reminder_type) {
          case 'two_days':
            title = '📅 Sua escala está chegando';
            message = `Você está escalado para "${event.title}" em ${formattedDate} às ${formattedTime}. Faltam 2 dias!`;
            break;
          case 'one_day':
            title = '⏰ Sua escala é amanhã!';
            message = `Lembrete: você serve amanhã em "${event.title}" às ${formattedTime}. Prepare-se!`;
            break;
          case 'same_day':
            title = '🔔 Sua escala é hoje!';
            message = `Você está escalado para "${event.title}" hoje às ${formattedTime}. Deus abençoe seu serviço!`;
            break;
        }

        // Send in-app notification
        await supabase.rpc('send_notification', {
          _user_id: reminder.user_id,
          _title: title,
          _message: message,
          _type: 'reminder',
          _related_schedule_id: reminder.schedule_id,
        });

        // Send push notification
        const { data: subscriptions } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', reminder.user_id);

        if (subscriptions && subscriptions.length > 0) {
          for (const sub of subscriptions) {
            try {
              await fetch(sub.endpoint, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'TTL': '86400',
                },
                body: JSON.stringify({
                  title,
                  body: message,
                  icon: '/icons/icon-192.png',
                  badge: '/icons/icon-192.png',
                  data: {
                    url: `/escalas`,
                    scheduleId: reminder.schedule_id,
                  },
                }),
              });
            } catch (pushError) {
              console.error(`Push failed for ${reminder.user_id}:`, pushError);
            }
          }
        }

        // Mark as sent
        await supabase
          .from('schedule_reminders')
          .update({ sent: true, sent_at: new Date().toISOString() })
          .eq('id', reminder.id);

        sentCount++;
      } catch (reminderError) {
        console.error(`Error processing reminder ${reminder.id}:`, reminderError);
      }
    }

    return new Response(
      JSON.stringify({ message: 'Reminders processed', sent: sentCount, skipped: skippedCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing reminders:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
