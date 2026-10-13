import { isDemoMode, supabase } from './supabase'

export type PushState = 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on'

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

export function registerServiceWorker() {
  if (isDemoMode || !('serviceWorker' in navigator)) return
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}

export async function getPushState(): Promise<PushState> {
  if (isDemoMode) return 'unsupported'
  // En iPhone solo funciona con la app instalada en la pantalla de inicio.
  if (isIos() && !isStandalone()) return 'ios-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

/** Pide permiso, suscribe este dispositivo y guarda la suscripción. Devuelve un mensaje de error o null. */
export async function enablePush(userId: string): Promise<string | null> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'No se dio permiso para mostrar avisos.'

  const { data: key, error: keyError } = await supabase!.rpc('get_vapid_public_key')
  if (keyError || !key) return 'Los avisos al celular todavía no están configurados.'

  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key as string) }))

  const json = sub.toJSON()
  const { error } = await supabase!
    .from('push_subscriptions')
    .upsert({ user_id: userId, endpoint: sub.endpoint, p256dh: json.keys!.p256dh, auth: json.keys!.auth }, { onConflict: 'endpoint' })
  return error ? 'No se pudo guardar la suscripción. Intenta de nuevo.' : null
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await supabase!.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}
