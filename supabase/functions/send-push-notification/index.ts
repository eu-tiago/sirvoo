import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";
import { buildPushHTTPRequest } from "npm:@pushforge/builder@^1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Convert a base64url-encoded raw ECDSA P-256 private key (32 bytes)
 * into a JWK that @pushforge/builder expects.
 */
function rawPrivateKeyToJWK(rawB64: string, publicKeyB64: string): JsonWebKey {
  // Decode the public key (65 bytes uncompressed: 0x04 || x(32) || y(32))
  const pubBytes = base64urlToUint8Array(publicKeyB64);
  const x = uint8ArrayToBase64url(pubBytes.slice(1, 33));
  const y = uint8ArrayToBase64url(pubBytes.slice(33, 65));
  const d = rawB64; // already base64url

  return {
    kty: "EC",
    crv: "P-256",
    x,
    y,
    d,
    ext: true,
  };
}

function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error('VAPID keys not configured');
      return new Response(
        JSON.stringify({ error: 'Push notifications not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Require authenticated caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const callerId = claimsData.claims.sub as string;

    // Build JWK from raw VAPID keys
    const privateJWK = rawPrivateKeyToJWK(vapidPrivateKey, vapidPublicKey);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { userId, userIds, title, body: msgBody, data } = body ?? {};

    // Validate inputs
    const titleStr = typeof title === 'string' ? title.slice(0, 120) : '';
    const messageStr = typeof msgBody === 'string' ? msgBody.slice(0, 500) : '';
    if (!titleStr || !messageStr) {
      return new Response(
        JSON.stringify({ error: 'title and body are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let targetUserIds: string[] = Array.isArray(userIds)
      ? userIds.filter((u: unknown) => typeof u === 'string' && uuidRe.test(u))
      : (typeof userId === 'string' && uuidRe.test(userId) ? [userId] : []);
    targetUserIds = Array.from(new Set(targetUserIds)).slice(0, 500);

    if (targetUserIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid users specified' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authorization: caller may only target users that share a church with them
    const { data: callerChurches } = await supabase
      .from('church_members')
      .select('church_id')
      .eq('user_id', callerId);
    const callerChurchIds = (callerChurches ?? []).map((r: any) => r.church_id);
    if (callerChurchIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const { data: allowedMembers } = await supabase
      .from('church_members')
      .select('user_id')
      .in('church_id', callerChurchIds)
      .in('user_id', targetUserIds);
    const allowedSet = new Set((allowedMembers ?? []).map((m: any) => m.user_id));
    targetUserIds = targetUserIds.filter((id) => allowedSet.has(id));
    if (targetUserIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No authorized recipients' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use sanitized values from here on
    const title2 = titleStr;
    const body2 = messageStr;

    console.log(`Sending push notification to ${targetUserIds.length} users`);

    // Get push subscriptions for target users
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', targetUserIds);

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No push subscriptions found for users');
      return new Response(
        JSON.stringify({ message: 'No subscriptions found', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = {
      title: title2,
      body: body2,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: data || {},
    };

    let successCount = 0;
    let failureCount = 0;

    for (const sub of subscriptions) {
      try {
        const subscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        // Build encrypted push request using @pushforge/builder
        const pushRequest = await buildPushHTTPRequest({
          privateJWK,
          subscription,
          message: {
            payload,
            ttl: 86400,
          },
        });

        const response = await fetch(pushRequest.endpoint, {
          method: 'POST',
          headers: pushRequest.headers,
          body: pushRequest.body,
        });

        if (response.ok || response.status === 201) {
          successCount++;
          console.log(`Push sent successfully to ${sub.user_id}`);
        } else if (response.status === 410 || response.status === 404) {
          // Subscription expired, delete it
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id);
          console.log(`Deleted expired subscription for ${sub.user_id}`);
          failureCount++;
        } else {
          const errorText = await response.text();
          console.error(`Push failed for ${sub.user_id}: ${response.status} - ${errorText}`);
          failureCount++;
        }
      } catch (error) {
        console.error(`Error sending push to ${sub.user_id}:`, error);
        failureCount++;
      }
    }

    // Also create in-app notifications
    for (const uid of targetUserIds) {
      await supabase.rpc('send_notification', {
        _user_id: uid,
        _title: title2,
        _message: body2,
        _type: 'push',
        _related_schedule_id: data?.scheduleId || null,
      });
    }

    return new Response(
      JSON.stringify({ 
        message: 'Push notifications sent',
        sent: successCount,
        failed: failureCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in send-push-notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
