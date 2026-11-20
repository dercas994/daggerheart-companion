// Service worker minimale: rete prima di tutto, cache solo come riserva offline.
// Le pagine si chiedono sempre al server (niente cache HTTP), così una nuova
// versione del sito arriva subito invece di restare bloccati su quella vecchia.
const CACHE = 'dh-shell-v2'
self.addEventListener('install', () => { self.skipWaiting() })
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', e => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== location.origin) return
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html') || url.pathname.endsWith('sw.js')
  const net = isPage ? fetch(req, { cache: 'no-store' }) : fetch(req)
  e.respondWith(
    net.then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(isPage ? url.pathname : req, copy)) }
      return res
    }).catch(() => caches.match(isPage ? url.pathname : req).then(r => r || caches.match(req)))
  )
})
