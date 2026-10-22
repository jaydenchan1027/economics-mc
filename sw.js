/* Generated cache version and resource list; regenerate with scripts/update-cache.py. */
importScripts('offline-manifest.js');
const CACHE_PREFIX = 'econ-mc-';
const CACHE_NAME = CACHE_PREFIX + self.ECON_OFFLINE_MANIFEST.version;
const ROOT = new URL('./', self.location.href);
const shell = self.ECON_OFFLINE_MANIFEST.shell.map(path => new URL(path, ROOT).href);
const scans = self.ECON_OFFLINE_MANIFEST.scans.map(path => new URL(path, ROOT).href);
const resources = new Set([...shell, ...scans]);
let downloading = null;
let downloadError = false;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(shell.map(url => new Request(url, {cache: 'reload'})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Scans use content hashes, so previously downloaded images remain valid.
    const cache = await caches.open(CACHE_NAME);
    const keys = await caches.keys();
    for (const key of keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)) {
      const old = await caches.open(key);
      for (const request of await old.keys()) {
        if (resources.has(request.url) && scans.includes(request.url)) {
          const response = await old.match(request);
          if (response) await cache.put(request, response);
        }
      }
      await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const navigation = event.request.mode === 'navigate' && url.origin === ROOT.origin && url.pathname.startsWith(ROOT.pathname);
  if (!navigation && !resources.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const key = navigation ? new URL('index.html', ROOT).href : url.href;
    const cached = await cache.match(key);
    if (cached) return cached;
    const response = await fetch(event.request);
    if (response.ok && resources.has(key)) await cache.put(key, response.clone());
    return response;
  })());
});

async function reportStatus() {
  const cache = await caches.open(CACHE_NAME);
  const saved = new Set((await cache.keys()).map(request => request.url));
  const message = {type: 'OFFLINE_STATUS', available: shell.every(url => saved.has(url)), count: scans.filter(url => saved.has(url)).length,
    total: scans.length, busy: !!downloading, error: downloadError};
  const clients = await self.clients.matchAll({includeUncontrolled: true});
  for (const client of clients) client.postMessage(message);
}

async function downloadScans() {
  downloadError = false;
  const cache = await caches.open(CACHE_NAME);
  const saved = new Set((await cache.keys()).map(request => request.url));
  const remaining = scans.filter(url => !saved.has(url));
  let cursor = 0, completed = 0;
  // Bound concurrency and retain completed files so failed downloads can resume.
  await Promise.all(Array.from({length: 6}, async () => {
    while (cursor < remaining.length) {
      const url = remaining[cursor++];
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Scan download failed');
        await cache.put(url, response);
      } catch {
        downloadError = true;
      }
      completed++;
      if (completed % 30 === 0) await reportStatus();
    }
  }));
}

self.addEventListener('message', event => {
  if (event.data?.type === 'OFFLINE_STATUS') event.waitUntil(reportStatus());
  if (event.data?.type === 'DOWNLOAD_SCANS') {
    if (!downloading) {
      downloading = downloadScans().catch(() => { downloadError = true; }).finally(async () => {
        downloading = null;
        await reportStatus();
      });
    }
    event.waitUntil(downloading);
  }
});
