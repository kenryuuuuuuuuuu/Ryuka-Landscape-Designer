const CACHE = 'ryuka-landscape-v4-7-0-local-glb-assets-20260714';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg', './vendor/three.min.js', './vendor/GLTFLoader.js', './data/fixed-site-data.js', './js/ground-materials.js', './js/building-materials.js', './js/building-model.js', './js/plant-materials.js', './js/plant-models.js', './js/environment-materials.js', './js/environment-model.js', './js/design-state.js', './js/plant-editor.js', './js/asset-catalog.js', './js/asset-loader.js', './js/app.js', './assets/models/tool-shed-high.glb', './assets/models/tool-shed-low.glb', './assets/models/garden-bench-high.glb', './assets/models/garden-bench-low.glb', './assets/models/raised-bed-frame-high.glb', './assets/models/raised-bed-frame-low.glb', './assets/models/README.md'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request).then(response => {
    if (response.ok && new URL(event.request.url).origin === self.location.origin) {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => event.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())));
});
