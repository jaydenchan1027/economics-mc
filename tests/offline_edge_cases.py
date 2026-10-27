"""Offline failure paths using real app code and a two-scan fixture."""
import functools
import http.server
import json
import os
from pathlib import Path
import shutil
import tempfile
import threading
import unittest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent


class Handler(http.server.SimpleHTTPRequestHandler):
    blocked = set()
    quota_failure = False
    hits = {}

    def log_message(self, *args):
        pass

    def do_GET(self):
        cls = type(self)
        cls.hits[self.path] = cls.hits.get(self.path, 0) + 1
        if self.path in cls.blocked:
            self.send_error(503, 'Simulated unavailable offline resource')
            return
        if self.path.endswith('/sw.js') and cls.quota_failure:
            script = (ROOT / 'sw.js').read_text()
            script = '''const originalPut = Cache.prototype.put;
Cache.prototype.put = function(request, response) {
  if (String(request.url || request).includes('/assets/scans/'))
    return Promise.reject(new DOMException('Storage full', 'QuotaExceededError'));
  return originalPut.call(this, request, response);
};\n''' + script
            body = script.encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/javascript')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()


class OfflineEdgeChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        fixture = Path(cls.temp.name)
        manifest = json.loads((ROOT / 'offline-manifest.js').read_text().split('=', 1)[1].rstrip(';\n'))
        cls.scans = manifest['scans'][:2]
        manifest['scans'] = cls.scans
        manifest['version'] = 'offline-edge-fixture'
        cls.manifest = manifest
        for scope in ['bank', 'other']:
            directory = fixture / scope
            directory.mkdir()
            for name in [*manifest['shell'], 'sw.js', *cls.scans]:
                target = directory / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.symlink_to(ROOT / name)
            (directory / 'offline-manifest.js').write_text('self.ECON_OFFLINE_MANIFEST=' + json.dumps(manifest) + ';\n')
        cls.server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=fixture))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.origin = f'http://127.0.0.1:{cls.server.server_port}'
        cls.url = cls.origin + '/bank/'
        cls.playwright = sync_playwright().start()
        engine = os.environ.get('ECON_BROWSER', 'chromium')
        executable = (os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')) if engine == 'chromium' else None
        cls.browser = getattr(cls.playwright, engine).launch(executable_path=executable, args=['--no-sandbox'] if engine == 'chromium' else [])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.temp.cleanup()

    def setUp(self):
        Handler.blocked = set()
        Handler.hits = {}
        Handler.quota_failure = False
        for scope in ['bank', 'other']:
            (Path(self.temp.name) / scope / 'offline-manifest.js').write_text(
                'self.ECON_OFFLINE_MANIFEST=' + json.dumps(self.manifest) + ';\n')
        self.context = self.browser.new_context()
        self.page = self.context.new_page()
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])

    def open_bank(self):
        self.page.goto(self.url)
        self.page.wait_for_selector('[data-topic="1"]')
        self.page.wait_for_function("document.querySelector('#offlineStatus').textContent.includes('TEXT SAVED')")

    def settings(self):
        self.page.locator('#settingsBtn').click()

    def download(self):
        self.page.locator('#downloadOffline').click()
        self.page.wait_for_function("document.querySelector('#offlineStatus').textContent.trim()==='OFFLINE READY'")

    def test_quota_failure_preserves_successful_online_scan_response(self):
        Handler.quota_failure = True
        self.open_bank()
        dimensions = self.page.evaluate('''src => new Promise((resolve, reject) => {
          const image = new Image(); image.onload = () => resolve([image.naturalWidth, image.naturalHeight]);
          image.onerror = () => reject(new Error('Online scan failed')); image.src = src;
        })''', self.scans[0])
        self.assertGreater(dimensions[0], 0)
        self.settings()
        self.page.wait_for_function("document.querySelector('#offlineDetail').textContent.includes('0 / 2')")
        self.page.locator('#downloadOffline').click()
        self.page.wait_for_function("document.querySelector('#offlineDetail').textContent.includes('interrupted')")
        self.assertTrue(self.page.locator('#downloadOffline').is_enabled())
        self.assertNotEqual(self.page.locator('#offlineStatus').inner_text().strip(), 'OFFLINE READY')

    def test_scan_navigation_returns_an_image_online_and_offline(self):
        self.open_bank()
        self.settings()
        self.download()
        for offline in [False, True]:
            with self.subTest(offline=offline):
                self.context.set_offline(offline)
                tab = self.context.new_page()
                response = tab.goto(self.url + self.scans[0])
                self.assertEqual(response.status, 200)
                self.assertIn('image/webp', response.headers['content-type'])
                self.assertGreater(tab.locator('img').evaluate('(image) => image.naturalWidth'), 0)
                tab.close()

    def test_project_caches_and_status_do_not_interfere(self):
        self.open_bank()
        self.settings()
        self.download()
        self.page.evaluate("window.receivedScopes=[]; navigator.serviceWorker.addEventListener('message', e=>window.receivedScopes.push(e.data.scope))")
        other = self.context.new_page()
        other.goto(self.origin + '/other/')
        other.wait_for_function("document.querySelector('#offlineStatus').textContent.includes('TEXT SAVED')")
        self.page.evaluate('window.ECON_OFFLINE.refresh()')
        self.page.wait_for_function('window.receivedScopes.length > 0')
        self.assertEqual(set(self.page.evaluate('window.receivedScopes')), {self.url})
        keys = self.page.evaluate('caches.keys()')
        self.assertTrue(any('econ-mc-%2Fbank%2F-' in key for key in keys))
        self.assertTrue(any('econ-mc-%2Fother%2F-' in key for key in keys))
        self.assertEqual(self.page.locator('#offlineStatus').inner_text().strip(), 'OFFLINE READY')
        # Messages from a sibling project must not change this page's badge.
        self.page.evaluate('''scope => navigator.serviceWorker.dispatchEvent(new MessageEvent('message', {
          data: {type:'OFFLINE_STATUS',scope,available:false,count:0,total:2,busy:false,error:false}
        }))''', self.origin + '/other/')
        self.assertEqual(self.page.locator('#offlineStatus').inner_text().strip(), 'OFFLINE READY')
        self.context.set_offline(True)
        self.page.reload()
        self.page.wait_for_function("document.querySelector('#offlineStatus').textContent.trim()==='OFFLINE READY'")

    def test_evicted_cache_can_be_repaired_without_clearing_registration(self):
        self.open_bank()
        self.settings()
        self.page.evaluate("caches.keys().then(keys=>Promise.all(keys.map(key=>caches.delete(key))))")
        self.page.evaluate('window.ECON_OFFLINE.refresh()')
        self.page.wait_for_function("document.querySelector('#offlineStatus').textContent.trim()==='ONLINE ACCESS'")
        self.assertTrue(self.page.locator('#downloadOffline').is_enabled())
        self.download()
        self.context.set_offline(True)
        self.page.reload()
        self.page.wait_for_selector('[data-topic="1"]')
        self.page.wait_for_function("document.querySelector('#offlineStatus').textContent.trim()==='OFFLINE READY'")

    def test_failed_first_registration_can_retry_from_settings(self):
        Handler.blocked = {'/bank/sw.js'}
        self.page.goto(self.url)
        self.page.wait_for_selector('[data-topic="1"]')
        self.settings()
        self.page.wait_for_function("document.querySelector('#downloadOffline').textContent.includes('Retry')")
        self.assertTrue(self.page.locator('#downloadOffline').is_enabled())
        Handler.blocked.clear()
        self.download()
        self.context.set_offline(True)
        self.page.reload()
        self.page.wait_for_selector('[data-topic="1"]')
        self.page.wait_for_function("document.querySelector('#offlineStatus').textContent.trim()==='OFFLINE READY'")

    def test_failed_first_installation_can_retry_from_settings(self):
        Handler.blocked = {'/bank/favicon.svg'}
        self.context.add_init_script('''
          const register = navigator.serviceWorker.register.bind(navigator.serviceWorker);
          navigator.serviceWorker.register = async (...args) => {
            const registration = await register(...args);
            const worker = registration.installing;
            if (worker) {
              window.testInstallState = worker.state;
              worker.addEventListener('statechange', () => window.testInstallState = worker.state);
            }
            return registration;
          };
        ''')
        self.page.goto(self.url)
        self.page.wait_for_selector('[data-topic="1"]')
        self.page.wait_for_function("window.testInstallState === 'redundant'")
        self.settings()
        self.assertTrue(self.page.locator('#downloadOffline').is_enabled())
        Handler.blocked.clear()
        self.download()
        self.context.set_offline(True)
        self.page.reload()
        self.page.wait_for_selector('[data-topic="1"]')

    def test_worker_update_preserves_downloaded_scans(self):
        self.open_bank()
        self.settings()
        self.download()
        manifest = dict(self.manifest, version='offline-edge-updated')
        (Path(self.temp.name) / 'bank' / 'offline-manifest.js').write_text(
            'self.ECON_OFFLINE_MANIFEST=' + json.dumps(manifest) + ';\n')
        self.page.evaluate('''async () => {
          window.testControllerChanged = false;
          navigator.serviceWorker.addEventListener('controllerchange', () => window.testControllerChanged = true, {once:true});
          const registration = await navigator.serviceWorker.getRegistration();
          await registration.update();
        }''')
        self.page.wait_for_function("window.testControllerChanged && navigator.serviceWorker.controller.state === 'activated'")
        self.page.wait_for_function("document.querySelector('#offlineStatus').textContent.trim()==='OFFLINE READY'")
        keys = self.page.evaluate('caches.keys()')
        self.assertIn('econ-mc-%2Fbank%2F-offline-edge-updated', keys)
        self.assertNotIn('econ-mc-%2Fbank%2F-offline-edge-fixture', keys)
        self.context.set_offline(True)
        self.page.reload()
        self.page.wait_for_selector('[data-topic="1"]')
        self.page.wait_for_function("document.querySelector('#offlineStatus').textContent.trim()==='OFFLINE READY'")
        self.assertEqual(self.page.evaluate('''async scans => {
          await Promise.all(scans.map(src=>new Promise((resolve,reject)=>{
            const image=new Image();image.onload=resolve;image.onerror=reject;image.src=src;
          })));
          return scans.length;
        }''', self.scans), 2)


if __name__ == '__main__':
    unittest.main(verbosity=2)
