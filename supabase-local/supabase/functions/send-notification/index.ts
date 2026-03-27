import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  user_ids: string[];
  type: string;
  title: string;
  body: string;
  task_id?: string;
  tenant_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const payload: NotificationPayload = await req.json();
    const { user_ids, type, title, body, task_id, tenant_id } = payload;

    if (!user_ids || user_ids.length === 0) {
      return new Response(JSON.stringify({ error: 'No user_ids provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch device tokens for these users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, device_token')
      .in('id', user_ids)
      .not('device_token', 'is', null);

    if (usersError) throw usersError;

    // Insert notification records
    const notifications = user_ids.map((uid) => ({
      tenant_id,
      user_id: uid,
      task_id: task_id ?? null,
      type,
      title,
      body,
      sent_at: new Date().toISOString(),
    }));

    await supabase.from('notifications').insert(notifications);

    // Send Expo push notifications if access token is configured
    const tokensToNotify = (users ?? [])
      .filter((u) => u.device_token)
      .map((u) => u.device_token);

    if (expoAccessToken && tokensToNotify.length > 0) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${expoAccessToken}`,
        },
        body: JSON.stringify(
          tokensToNotify.map((token) => ({
            to: token,
            sound: 'default',
            title,
            body,
            data: { type, task_id: task_id ?? '', tenant_id },
          }))
        ),
      });
    }

    return new Response(
      JSON.stringify({ success: true, notified: user_ids.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
