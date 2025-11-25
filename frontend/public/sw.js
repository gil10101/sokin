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
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        // Silently fail if cache fails - don't block service worker installation
        console.warn('Failed to cache static assets:', err)
      })
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
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return
  }

  // Skip cross-origin requests
  const url = new URL(event.request.url)
  if (url.origin !== location.origin) {
    return
  }

  const { request } = event

  // Cache API responses with stale-while-revalidate strategy
  if (API_CACHE_ENDPOINTS.some(endpoint => url.pathname.includes(endpoint))) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const cachedResponse = await cache.match(request)
          
          // Return cached response immediately
          const networkPromise = fetch(request).then((response) => {
            // Update cache with fresh response
            if (response.ok) {
              cache.put(request, response.clone()).catch(() => {
                // Silently fail cache update
              })
            }
            return response
          }).catch(() => {
            // Return cached response if network fails
            return cachedResponse
          })

          return cachedResponse || networkPromise
        } catch (err) {
          // Fallback to network if cache fails
          return fetch(request)
        }
      }).catch(() => {
        // Fallback to network if cache open fails
        return fetch(request)
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
              cache.put(request, responseClone).catch(() => {
                // Silently fail cache update
              })
            }).catch(() => {
              // Silently fail if cache open fails
            })
          }
          return response
        })
      }).catch(() => {
        // Fallback to network if cache fails
        return fetch(request)
      })
    )
  }
})