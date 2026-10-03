const CACHE = 'dayplan-shell-v1'
const APP_SHELL = ['/', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png']

self.addEventListener('install', event => {
  event.waitUntil(Promise.all([
    caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)),
    self.skipWaiting()
  ]))
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok) caches.open(CACHE).then(cache => cache.put('/', response.clone()))
        return response
      }).catch(async () => (await caches.match('/')) || Response.error())
    )
    return
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone()))
      return response
    }))
  )
})

self.addEventListener('push', event => {
  let message = { title: 'DayPlan', body: 'You have an update in your planner.', url: '/' }
  if (event.data) {
    try {
      message = { ...message, ...event.data.json() }
    } catch {
      message.body = event.data.text()
    }
  }
  event.waitUntil(self.registration.showNotification(message.title, {
    body: message.body,
    icon: '/apple-touch-icon.png',
    badge: '/apple-touch-icon.png',
    tag: message.tag,
    data: { url: message.url || '/' }
  }))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    const existing = clients.find(client => client.url.startsWith(self.location.origin))
    if (existing) {
      if ('navigate' in existing) existing.navigate(target)
      return existing.focus()
    }
    return self.clients.openWindow(target)
  }))
})
