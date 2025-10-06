const CACHE = 'bkk-guide-v1';
const ASSETS = [
  '/', '/index.html', '/styles.css', '/app.js',
  '/data/places.json', '/i18n/en.json', '/i18n/th.json',
  '/assets/icon-192.png', '/assets/icon-512.png', '/manifest.webmanifest'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e=>{
  const url = new URL(e.request.url);
  if (ASSETS.includes(url.pathname)) {
    e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request)));
    return;
  }
  // For other requests, try network then cache fallback
  e.respondWith(fetch(e.request).then(r=>{
    const copy = r.clone();
    caches.open(CACHE).then(c=>c.put(e.request, copy));
    return r;
  }).catch(()=>caches.match(e.request)));
});
