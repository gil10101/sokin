const STATIC_CACHE_NAME = 'sokin-static-v2.0.0'

// Static assets to cache
const STATIC_ASSETS = [
  '/sokin-icon.png',
  '/manifest.json',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    })
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Purge all previous cache generations, including the old
          // authenticated-API cache (sokin-v1.0.0) which must never come back:
          // the Cache API keys by URL only, so cached /api responses leak
          // one user's data to the next on a shared browser.
          if (cacheName !== STATIC_CACHE_NAME) {
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Never intercept navigations or API calls; only GET requests are cacheable.
  if (request.mode === 'navigate' || request.method !== 'GET') {
    return
  }
  if (new URL(request.url).pathname.startsWith('/api/')) {
    return
  }

  // Cache static assets with cache-first strategy
  if (request.destination === 'image' || request.destination === 'font' || request.destination === 'style') {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse
        }
        return fetch(request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone()
            caches.open(STATIC_CACHE_NAME).then((cache) => {
              cache.put(request, responseClone)
            })
          }
          return response
        })
      })
    )
  }
})
