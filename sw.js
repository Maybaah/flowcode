/* flowcode: service worker.

   Strategy is split by how a file changes:

   - Code and markup (html, css, js, manifest) are network-first. A pure
     cache-first worker will happily serve last week's build, and worse, during
     an update the *previous* worker is still handling requests, so a changed
     file (js/config.js turning the leaderboard on, say) could be missed for a
     whole visit. Network-first keeps a deploy honest; the cache is the fallback
     when the network is gone, so offline still works.
   - Fonts and images never change without changing their name, so they are
     served cache-first and cost nothing after the first visit.

   Bump CACHE when the precache list itself changes. */
"use strict";
const CACHE = "flowcode-v5";

const ASSETS = [
  ".",
  "index.html",
  "style.css",
  "fonts.css",
  "manifest.webmanifest",
  "js/config.js",
  "js/leaderboard.js",
  "js/stats.js",
  "js/words.js",
  "js/verify.js",
  "js/audio.js",
  "js/game.js",
  "js/main.js",
  "assets/hero.svg",
  "assets/icon.svg",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "assets/fonts/JetBrainsMono-latin.woff2",
  "assets/fonts/JetBrainsMono-cyrillic.woff2",
  "assets/fonts/ChakraPetch-500-latin.woff2",
  "assets/fonts/ChakraPetch-700-latin.woff2",
];

const IMMUTABLE = /\.(woff2|png|svg|ico)$/i;

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// only ever read this worker's own cache, never a leftover from an older version
async function fromCache(req) {
  const cache = await caches.open(CACHE);
  return cache.match(req, { ignoreSearch: true });
}

async function store(req, res) {
  if (!res || !res.ok || res.type === "opaque") return;
  const cache = await caches.open(CACHE);
  await cache.put(req, res.clone());
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    await store(req, res);
    return res;
  } catch (err) {
    const hit = await fromCache(req);
    if (hit) return hit;
    // a navigation with nothing cached still deserves the app shell
    if (req.mode === "navigate") {
      const shell = await fromCache(new Request("index.html"));
      if (shell) return shell;
    }
    throw err;
  }
}

async function cacheFirst(req) {
  const hit = await fromCache(req);
  if (hit) return hit;
  const res = await fetch(req);
  await store(req, res);
  return res;
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || !req.url.startsWith(self.location.origin)) return;
  const { pathname } = new URL(req.url);
  // leaderboard traffic must always hit the network
  if (pathname.includes("/api/")) return;
  e.respondWith(IMMUTABLE.test(pathname) ? cacheFirst(req) : networkFirst(req));
});
