import { createClient } from 'jsr:@supabase/supabase-js@2'

interface ReservationRecord {
  id: string
  tenant_id: string
  starts_at: string
  ends_at: string
}

interface WebhookPayload {
  type: string
  table: string
  record: ReservationRecord
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/** Formatea un timestamp local sin zona horaria ("YYYY-MM-DDTHH:mm:ss") en es-ES. */
function formatLocalDateTime(localDateTime: string, options: Intl.DateTimeFormatOptions): string {
  const [datePart, timePart] = localDateTime.split('T')
  const [y, m, d] = datePart.split('-').map(Number)
  const [h, mi] = timePart.split(':').map(Number)
  // Se construye como si fuera UTC para que Intl no vuelva a correr la hora local.
  return new Date(Date.UTC(y, m - 1, d, h, mi)).toLocaleString('es-ES', { ...options, timeZone: 'UTC' })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const webhookSecret = Deno.env.get('WEBHOOK_SECRET')
  const receivedSecret = req.headers.get('x-webhook-secret')
  if (!webhookSecret || receivedSecret !== webhookSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

  const payload = (await req.json()) as WebhookPayload
  if (payload.table !== 'reservations' || payload.type !== 'INSERT') {
    return new Response('Ignored', { status: 200 })
  }

  const { tenant_id, starts_at, ends_at } = payload.record

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('first_name, last_name, room_number, room_type, phone')
    .eq('id', tenant_id)
    .single()

  if (profileError || !profile) {
    console.error('No se pudo leer el perfil del inquilino', profileError)
    return new Response('Not found', { status: 404 })
  }

  const formattedDate = formatLocalDateTime(starts_at, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const startTime = formatLocalDateTime(starts_at, { hour: '2-digit', minute: '2-digit' })
  const endTime = formatLocalDateTime(ends_at, { hour: '2-digit', minute: '2-digit' })

  const tenantName = escapeHtml(`${profile.first_name} ${profile.last_name}`)
  const roomNumber = escapeHtml(profile.room_number)
  const roomType = escapeHtml(profile.room_type === 'suite' ? 'Suite' : 'Normal')
  const phone = escapeHtml(profile.phone)
  const safeFormattedDate = escapeHtml(formattedDate)
  const safeTimeRange = escapeHtml(`${startTime} – ${endTime}`)

  const html = `
    <h2>Nueva reserva de lavadora</h2>
    <p><strong>Inquilino:</strong> ${tenantName}</p>
    <p><strong>Habitación:</strong> ${roomNumber} (${roomType})</p>
    <p><strong>Teléfono:</strong> ${phone}</p>
    <p><strong>Fecha:</strong> ${safeFormattedDate}</p>
    <p><strong>Horario:</strong> ${safeTimeRange}</p>
  `

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: Deno.env.get('RESEND_FROM') ?? 'Lavadora <onboarding@resend.dev>',
      to: [Deno.env.get('OWNER_EMAIL')],
      subject: `Nueva reserva: ${tenantName} · ${formattedDate}`,
      html,
    }),
  })

  if (!resendResponse.ok) {
    const errorText = await resendResponse.text()
    console.error('Error al enviar el correo con Resend', errorText)
    return new Response('Email error', { status: 502 })
  }

  return new Response('OK', { status: 200 })
})
