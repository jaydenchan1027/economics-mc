/* Generated cache version and resource list; regenerate with scripts/update-cache.py. */
importScripts('offline-manifest.js');
const ROOT = new URL('./', self.location.href);
// Cache Storage is shared by all projects on a GitHub Pages origin.
const CACHE_PREFIX = 'econ-mc-' + encodeURIComponent(ROOT.pathname) + '-';
const CACHE_NAME = CACHE_PREFIX + self.ECON_OFFLINE_MANIFEST.version;
const shell = self.ECON_OFFLINE_MANIFEST.shell.map(path => new URL(path, ROOT).href);
const scans = self.ECON_OFFLINE_MANIFEST.scans.map(path => new URL(path, ROOT).href);
const scanURLs = new Set(scans);
const resources = new Set([...shell, ...scans]);
const pages = new Set(['', 'index.html', 'original.html'].map(path => new URL(path, ROOT).href));
const inScope = url => url.startsWith(ROOT.href);
let downloading = null;
let downloadError = false;

async function saveShell(cache) {
  const missing = [];
  for (const url of shell) if (!await cache.match(url)) missing.push(new Request(url, {cache: 'reload'}));
  await cache.addAll(missing);
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    await saveShell(await caches.open(CACHE_NAME));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Scans use content hashes, so previously downloaded images remain valid.
    const cache = await caches.open(CACHE_NAME);
    const keys = await caches.keys();
    for (const key of keys.filter(key => key !== CACHE_NAME &&
      (key.startsWith(CACHE_PREFIX) || /^econ-mc-[a-f0-9]{16}$/.test(key)))) {
      const old = await caches.open(key);
      const requests = await old.keys();
      for (const request of requests) {
        if (scanURLs.has(request.url)) {
          const response = await old.match(request);
          if (response) {
            // Lack of space for a migration must not stop the new app activating.
            try { await cache.put(request, response); } catch { downloadError = true; }
          }
        }
      }
      // Legacy versions shared an origin-wide cache. Preserve other projects' files.
      if (key.startsWith(CACHE_PREFIX) || requests.every(request => inScope(request.url))) await caches.delete(key);
    }
    await self.clients.claim();
    await reportStatus();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const pageURL = new URL(url); pageURL.search = '';
  const navigation = event.request.mode === 'navigate' && pages.has(pageURL.href);
  if (!navigation && !resources.has(url.href)) return;
  event.respondWith((async () => {
    const key = navigation ? new URL('index.html', ROOT).href : url.href;
    let cache;
    try {
      cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(key);
      if (cached) return cached;
    } catch { /* Online access still works when browser storage is unavailable. */ }
    const response = await fetch(navigation ? key : event.request);
    if (response.ok && cache) {
      try { await cache.put(key, response.clone()); } catch { downloadError = true; }
    }
    return response;
  })());
});

async function reportStatus() {
  let saved = new Set();
  try {
    const cache = await caches.open(CACHE_NAME);
    saved = new Set((await cache.keys()).map(request => request.url));
  } catch { downloadError = true; }
  const message = {type: 'OFFLINE_STATUS', scope: ROOT.href,
    available: shell.every(url => saved.has(url)), count: scans.filter(url => saved.has(url)).length,
    total: scans.length, busy: !!downloading, error: downloadError};
  const clients = await self.clients.matchAll({includeUncontrolled: true});
  for (const client of clients) if (inScope(client.url)) client.postMessage(message);
}

async function downloadScans() {
  downloadError = false;
  const cache = await caches.open(CACHE_NAME);
  // The browser may evict cached app files while the worker remains registered.
  await saveShell(cache);
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
  if (!event.source?.url || !inScope(event.source.url)) return;
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
