const CACHE = 'fireslot-v2'
const STATIC = ['/', '/tournaments', '/challenges', '/leaderboard']

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  const req = e.request

  // Never intercept Next internals.
  if (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/__nextjs')) {
    return
  }

  // API calls: network first, no cache
  if (url.pathname.startsWith('/api') || url.hostname.includes('your-api-domain')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"error":"offline"}', {
      headers: { 'Content-Type': 'application/json' }
    })))
    return
  }

  // App navigation: network first to avoid stale HTML that references old chunks.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res.status === 200) {
            caches.open(CACHE).then(c => c.put(req, res.clone()))
          }
          return res
        })
        .catch(() => caches.match(req).then(cached => cached || caches.match('/')))
    )
    return
  }

  // Static/pages: cache first, fallback network
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached
      return fetch(req).then(res => {
        if (res.status === 200) {
          caches.open(CACHE).then(c => c.put(req, res.clone()))
        }
        return res
      }).catch(() => caches.match('/'))  // fallback to home on offline
    })
  )
})
