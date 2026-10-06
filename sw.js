/* Offline support. The whole tool is stored on the device at first visit and
   served from there straight away on every later visit; fresh copies are
   fetched in the background whenever a connection exists. */
var CACHE = 'cyprus-board-f87715c6f3';
var SHELL = ['./', 'index.html', 'styles.css', 'js/i18n.js', 'js/lang/el.model.js', 'js/lang/el.ui.js', 'js/lang/tr.model.js', 'js/lang/tr.ui.js', 'js/lang/el.guide.js', 'js/lang/tr.guide.js', 'js/guide.js', 'js/model.js', 'js/engine.js', 'js/live.js', 'js/app.js', 'data/knowledge.json',
  'manifest.webmanifest', 'offline.html', 'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(SHELL.map(function (u) {
      return fetch(new Request(u, { cache: 'reload' })).then(function (r) { if (r.ok) return c.put(u, r); }).catch(function () {});
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE && k.indexOf('cyprus-board-') === 0; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; /* live data goes straight to its source */
  e.respondWith(caches.open(CACHE).then(function (c) {
    var key = req.mode === 'navigate' && !/offline\.html$/.test(url.pathname) ? 'index.html' : req;
    return c.match(key, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(req).then(function (r) {
        if (r && r.ok && r.type === 'basic') c.put(key, r.clone());
        return r;
      });
      if (hit) { e.waitUntil(net.catch(function () {})); return hit; }
      return net.catch(function () { return c.match('index.html'); });
    });
  }));
});
