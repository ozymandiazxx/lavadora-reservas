import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

// Lo llama el trigger de la base de datos (push_on_notification) con el secreto del webhook.
// Las llaves VAPID viven en la tabla push_config, que solo el service role puede leer.

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: cfg } = await supabase
    .from('push_config')
    .select('vapid_public, vapid_private, vapid_subject, webhook_secret')
    .single()

  if (!cfg?.webhook_secret || req.headers.get('x-webhook-secret') !== cfg.webhook_secret) {
    return new Response('Unauthorized', { status: 401 })
  }
  if (!cfg.vapid_public || !cfg.vapid_private) return new Response('VAPID no configurado', { status: 500 })

  const { user_id, title, body } = await req.json()
  if (!user_id || !title) return new Response('Bad request', { status: 400 })

  webpush.setVapidDetails(cfg.vapid_subject ?? 'mailto:admin@example.com', cfg.vapid_public, cfg.vapid_private)

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', user_id)

  const payload = JSON.stringify({ title, body })
  let sent = 0
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
        sent++
      } catch (err) {
        // 404/410: el dispositivo ya no existe (desinstalaron la app o revocaron el permiso).
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) await supabase.from('push_subscriptions').delete().eq('id', s.id)
      }
    }),
  )

  return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } })
})
