/* Demon Finder — The Sigil War : offline shell */
var CACHE = 'sigil-shell-v7';
var TILES = 'sigil-tiles-v7';
var SHELL = [
  './', './index.html', './manifest.json', './css/style.css',
  './js/i18n.js', './js/lang.js', './js/symbols.js', './js/cracker.js', './js/sigil.js', './js/crest.js', './js/data.js', './js/puzzles.js', './js/audio.js', './js/jinn.js', './js/net.js', './js/game.js',
  './vendor/leaflet.js', './vendor/leaflet.css',
  './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE && k !== TILES; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);

  if (/basemaps\.cartocdn\.com|tile\.openstreetmap\.org/.test(url.hostname)) {
    e.respondWith(caches.open(TILES).then(function (c) {
      return c.match(e.request).then(function (hit) {
        if (hit) return hit;
        return fetch(e.request).then(function (res) {
          if (res && (res.ok || res.type === 'opaque')) {
            c.put(e.request, res.clone()).then(function () { prune(c, 900); });
          }
          return res;
        }).catch(function () { return Response.error(); });
      });
    }));
    return;
  }

  if (url.origin === location.origin) {
    e.respondWith(caches.open(CACHE).then(function (c) {
      return c.match(e.request).then(function (hit) {
        return hit || fetch(e.request).then(function (res) {
          if (res && res.ok) c.put(e.request, res.clone());
          return res;
        }).catch(function () { return hit; });
      });
    }));
  }
});

function prune(cache, max) {
  cache.keys().then(function (keys) {
    if (keys.length <= max) return;
    for (var i = 0; i < keys.length - max; i++) cache.delete(keys[i]);
  });
}
