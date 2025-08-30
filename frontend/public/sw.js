const CACHE_NAME = 'sokin-v1.0.0'
const STATIC_CACHE_NAME = 'sokin-static-v1.0.0'

// Static assets to cache
const STATIC_ASSETS = [
  '/',
  '/sokin-icon.png',
  '/manifest.json',
]

// Cache API responses for these endpoints
const API_CACHE_ENDPOINTS = [
  '/api/dashboard',
  '/api/expenses',
  '/api/budgets',
  '/api/net-worth',
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
          if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
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
  const url = new URL(request.url)

  // Cache API responses with stale-while-revalidate strategy
  if (API_CACHE_ENDPOINTS.some(endpoint => url.pathname.includes(endpoint))) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request)
        
        // Return cached response immediately
        const networkPromise = fetch(request).then((response) => {
          // Update cache with fresh response
          if (response.ok) {
            cache.put(request, response.clone())
          }
          return response
        }).catch(() => {
          // Return cached response if network fails
          return cachedResponse
        })

        return cachedResponse || networkPromise
      })
    )
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