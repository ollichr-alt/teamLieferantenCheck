const CACHE = "lieferantencheck-shell-v0.5.0";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./src/app.js",
  "./src/search.js",
  "./src/styles.css",
  "./src/db/idb.js",
  "./src/db/schema.js",
  "./src/import/importer.js",
  "./src/ui/render.js",
  "./src/workspace/workspace.js",
  "./src/exchange/file-exchange.js",
  "./src/analytics/slow-movers.js",
  "./src/converter/v5191-contract.js",
  "./src/analytics/dashboard.js",
  "./src/import/segmented-importer.js",
  "./src/import/package-contract.js",
  "./src/analytics/problem-capital.js",
  "./src/commands/intent-executor.js",
  "./src/commands/navigation.js",
  "./src/ai/ai-controller.js",
  "./src/ai/cloudflare-provider.js",
  "./src/ai/local-provider.js",
  "./src/ai/permission-guard.js",
  "./src/ai/contracts.js"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
