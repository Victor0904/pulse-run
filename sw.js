// Service worker PULSE RUN : pré-cache de tous les fichiers (dont les 15 chartes), cache-first, nettoyage des anciennes versions.
const VERSION = 'pulserun-v1.0.0';
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'design/tokens.css',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'css/style.css',
  'src/audio/audio.js',
  'src/core/banner.js',
  'src/core/calib.js',
  'src/core/clock.js',
  'src/core/const.js',
  'src/core/messages.js',
  'src/core/rng.js',
  'src/core/tempo.js',
  'src/main.js',
  'src/meta/challenges.js',
  'src/meta/economy.js',
  'src/meta/save.js',
  'src/render/renderer.js',
  'src/sim/bot.js',
  'src/sim/chart.js',
  'src/sim/infinite.js',
  'src/sim/music.js',
  'src/sim/scoring.js',
  'src/sim/sim.js',
  'src/sim/validate.js',
  'src/songs/a1boss.js',
  'src/songs/a1s1.js',
  'src/songs/a1s2.js',
  'src/songs/a1s3.js',
  'src/songs/a1s4.js',
  'src/songs/a2boss.js',
  'src/songs/a2s1.js',
  'src/songs/a2s2.js',
  'src/songs/a2s3.js',
  'src/songs/a2s4.js',
  'src/songs/a3boss.js',
  'src/songs/a3s1.js',
  'src/songs/a3s2.js',
  'src/songs/a3s3.js',
  'src/songs/a3s4.js',
  'src/songs/index.js',
  'src/ui/ui.js',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('pulserun-') && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
    if (res && res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
