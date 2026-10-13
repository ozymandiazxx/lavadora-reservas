// Service worker: solo recibe notificaciones push y abre la app al tocarlas.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = { title: 'Lavadora', body: '' }
  try {
    data = { ...data, ...event.data.json() }
  } catch {
    // payload vacío o inválido: se muestra el aviso genérico
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const open = clients.find((c) => 'focus' in c)
      return open ? open.focus() : self.clients.openWindow('/')
    }),
  )
})
