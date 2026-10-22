/* The badge describes verified cache contents, never just network connectivity. */
(() => {
  'use strict';
  let worker, status = {available: false, busy: false, count: 0, total: 0};
  const badge = document.getElementById('offlineStatus');

  function render() {
    const complete = status.available && status.count === status.total;
    badge.classList.toggle('ready', complete);
    badge.replaceChildren(document.createElement('i'), document.createTextNode(
      complete ? ' OFFLINE READY' : status.available ? ' TEXT SAVED OFFLINE' : ' ONLINE ACCESS'));
    const detail = document.getElementById('offlineDetail');
    const button = document.getElementById('downloadOffline');
    if (!detail || !button) return;
    detail.textContent = status.available
      ? `${status.count} / ${status.total} scans saved on this device.${status.error && !status.busy ? ' Download interrupted. Reconnect and retry to save the remaining scans.' : complete ? ' The complete bank is ready for offline use.' : ''}`
      : 'Offline storage is unavailable. Keep an internet connection to reload the bank and view scans.';
    button.disabled = !status.available || status.busy || complete;
    button.textContent = status.busy ? 'Saving scans…' : complete ? '✓ All scans saved' : '↓ Download all scans for offline use (about 20 MB)';
  }

  function refresh() {
    if (worker) worker.postMessage({type: 'OFFLINE_STATUS'});
    else render();
  }
  window.ECON_OFFLINE = {refresh};
  document.addEventListener('click', e => {
    if (e.target.closest('#downloadOffline') && worker && !status.busy) {
      status.busy = true;
      render();
      worker.postMessage({type: 'DOWNLOAD_SCANS'});
    }
  });

  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    render();
    return;
  }
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data?.type !== 'OFFLINE_STATUS') return;
    status = {...status, ...e.data};
    render();
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    worker = navigator.serviceWorker.controller;
    refresh();
  });
  navigator.serviceWorker.register('sw.js', {updateViaCache: 'none'}).then(async () => {
    const registration = await navigator.serviceWorker.ready;
    worker = navigator.serviceWorker.controller || registration.active;
    refresh();
  }).catch(() => render());
})();
