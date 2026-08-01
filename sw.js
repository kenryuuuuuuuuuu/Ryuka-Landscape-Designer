const CACHE = 'ryuka-landscape-browser-review-9-20260801';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg', './vendor/three.min.js', './vendor/GLTFLoader.js', './data/fixed-site-data.js?v=browser-review-9', './js/workspaces.js?v=browser-review-9', './js/ground-materials.js', './js/building-materials.js?v=browser-review-9', './js/building-model.js?v=browser-review-9', './js/parking-model.js', './js/site-model.js?v=browser-review-9', './js/plant-materials.js', './js/plant-models.js', './js/environment-materials.js?v=browser-review-9', './js/environment-model.js?v=browser-review-9', './js/object-catalog.js?v=browser-review-9', './js/object-models.js?v=browser-review-9', './js/design-state.js?v=browser-review-9', './js/plant-editor.js', './js/object-editor.js', './js/asset-catalog.js', './js/asset-loader.js', './js/ground-feature-catalog.js', './js/ground-feature-models.js', './js/ground-feature-editor.js', './js/app.js?v=browser-review-9', './assets/models/tool-shed-high.glb', './assets/models/tool-shed-low.glb', './assets/models/garden-bench-high.glb', './assets/models/garden-bench-low.glb', './assets/models/raised-bed-frame-high.glb', './assets/models/raised-bed-frame-low.glb', './assets/models/README.md'];
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
  const url = new URL(event.request.url);
  const isAppSource = url.origin === self.location.origin
    && (event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('.js'));

  if (isAppSource) {
    event.respondWith(fetch(event.request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => (
      caches.match(event.request)
        .then(hit => hit || (event.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))
    )));
    return;
  }

  event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request).then(response => {
    if (response.ok && new URL(event.request.url).origin === self.location.origin) {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => event.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())));
});
