/* flowcode — service worker: precache the app, serve cache-first, work offline */
"use strict";
/* Bump this whenever any precached file changes — the fetch handler is
   cache-first, so a stale version would keep serving the old build. */
const CACHE = "flowcode-v3";
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

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || !e.request.url.startsWith(self.location.origin)) return;
  // leaderboard traffic must always hit the network
  if (new URL(e.request.url).pathname.includes("/api/")) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      });
    })
  );
});
