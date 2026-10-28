/* The badge describes verified cache contents, never just network connectivity. */
(() => {
  'use strict';
  let worker, connection, status = {available: false, busy: false, count: 0, total: 0};
  const badge = document.getElementById('offlineStatus');
  const supported = 'serviceWorker' in navigator && window.isSecureContext;
  const scope = new URL('./', location.href).href;

  function render() {
    const complete = status.available && status.total > 0 && status.count === status.total;
    badge.classList.toggle('ready', complete);
    badge.replaceChildren(document.createElement('i'), document.createTextNode(
      complete ? ' OFFLINE READY' : status.available ? ' TEXT SAVED OFFLINE' : ' ONLINE ACCESS'));
    const detail = document.getElementById('offlineDetail');
    const button = document.getElementById('downloadOffline');
    if (!detail || !button) return;
    detail.textContent = status.available
      ? `${status.count} / ${status.total} scans saved on this device.${status.error && !status.busy ? ' Download interrupted. Reconnect and retry to save the remaining scans.' : complete ? ' The complete bank is ready for offline use.' : ''}`
      : supported ? 'Offline files are not fully saved. Reconnect and retry below. If saving keeps failing, check available browser storage.'
        : 'Offline storage is unavailable. Keep an internet connection to reload the bank and view scans.';
    button.disabled = !supported || status.busy || complete;
    button.textContent = status.busy ? 'Saving offline files…' : complete ? '✓ All scans saved'
      : status.available ? '↓ Download all scans for offline use (about 20 MB)' : '↻ Retry offline setup and save all scans (about 20 MB)';
  }

  function refresh() {
    if (worker) worker.postMessage({type: 'OFFLINE_STATUS'});
    else render();
  }

  function connect() {
    if (connection) return connection;
    connection = (async () => {
      const registration = await navigator.serviceWorker.register('sw.js', {updateViaCache: 'none'});
      const candidate = registration.active || registration.installing || registration.waiting;
      if (!candidate) throw new Error('Offline worker is unavailable');
      await new Promise((resolve, reject) => {
        const check = () => {
          if (candidate.state === 'activated' || candidate.state === 'redundant') {
            candidate.removeEventListener('statechange', check);
            candidate.state === 'activated' ? resolve() : reject(new Error('Offline setup failed'));
          }
        };
        candidate.addEventListener('statechange', check);
        check();
      });
      worker = navigator.serviceWorker.controller || registration.active;
      refresh();
    })().catch(() => {
      status.busy = false;
      render();
    }).finally(() => { connection = null; });
    return connection;
  }

  window.ECON_OFFLINE = {refresh};
  document.addEventListener('click', async e => {
    if (!e.target.closest('#downloadOffline') || !supported || status.busy) return;
    status.busy = true;
    render();
    if (!worker) await connect();
    if (worker) worker.postMessage({type: 'DOWNLOAD_SCANS'});
    else { status.busy = false; render(); }
  });

  if (!supported) {
    render();
    return;
  }
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data?.type !== 'OFFLINE_STATUS' || e.data.scope !== scope) return;
    status = {...status, ...e.data};
    render();
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    worker = navigator.serviceWorker.controller;
    refresh();
  });
  window.addEventListener('online', () => { if (worker) refresh(); else connect(); });
  connect();
})();
