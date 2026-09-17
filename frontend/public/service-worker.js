// Vite fills these values with every production asset and a content-based version.
const VERSION = "__BUILD_VERSION__";
const CACHE_NAME = `tuklas-webar-${VERSION}`;
const ASSETS = [/* __BUILD_ASSETS__ */];

async function prepare() {
  if (!ASSETS.length) throw new Error("Offline preparation requires a production build.");
  const cache = await caches.open(CACHE_NAME);
  const missing = [];
  for (const asset of ASSETS) {
    if (!(await cache.match(asset))) missing.push(new Request(asset, { cache: "reload" }));
  }
  await cache.addAll(missing);
}

self.addEventListener("install", event => {
  event.waitUntil(prepare().then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith("tuklas-webar-") && key !== CACHE_NAME)
      .map(key => caches.delete(key)),
  )).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  // Never cache authenticated API responses or unrelated external resources.
  if (event.request.method !== "GET" || url.origin !== self.location.origin ||
      url.pathname === "/api" || url.pathname.startsWith("/api/")) return;
  // A navigation-mode request covers both "the SPA route the app should
  // render" and "the user opened a real static file (e.g. the marker image)
  // in a new tab" - the browser uses the same request mode for both. Only
  // fall back to the app shell when the path isn't itself a known asset.
  const isSpaRoute = event.request.mode === "navigate" && !ASSETS.includes(url.pathname);
  const asset = isSpaRoute ? "/index.html" : url.pathname;
  if (!ASSETS.includes(asset)) return;
  // Keep HTML and its hashed imports from the same fully downloaded build.
  event.respondWith(caches.open(CACHE_NAME).then(async cache =>
    (await cache.match(asset)) || fetch(event.request),
  ));
});

self.addEventListener("message", event => {
  if (event.data?.type !== "CACHE_NOW") return;
  event.waitUntil(prepare().then(
    () => event.ports[0]?.postMessage({ ok: true }),
    error => event.ports[0]?.postMessage({ ok: false, error: error.message }),
  ));
});
