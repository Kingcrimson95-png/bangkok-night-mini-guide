const CACHE = 'bkk-guide-v2'; // Updated cache version
const ASSETS = [
  '/', 
  '/index.html', 
  '/styles.css', 
  '/app.js',
  '/data/places.json',
  '/data/stories.json', // <-- Added the new stories file here
  '/i18n/en.json', 
  '/i18n/th.json',
  '/assets/icon-192.png', 
  '/assets/icon-512.png', 
  '/manifest.webmanifest'
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
  // Always try network first for data files to get fresh data
  if (url.pathname.startsWith('/data/')) {
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  
  // For other assets, serve from cache first
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }))
  );
});
