// Saves data on repeat visits: hashed app files and covers come from the phone, not the network.
// Pages and server calls always go to the network, so prices, stock and sign-in are never stale.
const STATIC = 'static-v4'
const COVERS = 'covers-v1'
const MAX_COVERS = 300
// The clean URL: Cloudflare redirects /offline.html here, and a redirected response can't stand in for a page.
const OFFLINE = '/offline'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC)
      .then((cache) => cache.addAll([OFFLINE, '/brand/mark-48.png']))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC && k !== COVERS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function cacheFirst(request, name, limit) {
  const cache = await caches.open(name)
  const hit = await cache.match(request)
  if (hit) return hit
  const response = await fetch(request)
  if (response.ok) {
    await cache.put(request, response.clone())
    if (limit) {
      const keys = await cache.keys()
      if (keys.length > limit) await Promise.all(keys.slice(0, keys.length - limit).map((k) => cache.delete(k)))
    }
  }
  return response
}

// A fresh copy of the saved page, so the browser never sees it as a redirect.
async function offlinePage() {
  const saved = await caches.match(OFFLINE)
  if (!saved) return Response.error()
  return new Response(await saved.blob(), { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/assets/')) return event.respondWith(cacheFirst(request, STATIC))
    if (url.pathname.startsWith('/covers/')) return event.respondWith(cacheFirst(request, COVERS, MAX_COVERS))
    if (request.mode === 'navigate') return event.respondWith(fetch(request).catch(offlinePage))
    return
  }
  // Font files are versioned by URL and never change.
  if (url.hostname === 'fonts.gstatic.com') event.respondWith(cacheFirst(request, STATIC))
})
