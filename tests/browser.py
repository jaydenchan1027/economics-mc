"""Chromium regression checks, including GitHub Pages subpath and real offline refresh."""
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
    fail_once = None
    scan_requests = 0

    def log_message(self, *args):
        pass

    def do_GET(self):
        if '/assets/scans/' in self.path:
            type(self).scan_requests += 1
        if self.path == type(self).fail_once:
            type(self).fail_once = None
            self.send_error(503, 'Simulated interrupted download')
            return
        super().do_GET()


class BrowserChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        (Path(cls.temp.name) / 'bank').symlink_to(ROOT, target_is_directory=True)
        cls.server = http.server.ThreadingHTTPServer(
            ('127.0.0.1', 0), functools.partial(Handler, directory=cls.temp.name))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f'http://127.0.0.1:{cls.server.server_port}/bank/'
        cls.playwright = sync_playwright().start()
        executable = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
        cls.browser = cls.playwright.chromium.launch(executable_path=executable, args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.temp.cleanup()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1280, 'height': 900})
        self.page = self.context.new_page()
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.goto(self.url)
        self.page.wait_for_selector('[data-topic="1"]')
        self.page.wait_for_function("document.querySelector('#offlineStatus').textContent.includes('TEXT SAVED')")

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])

    def click(self, selector):
        self.page.locator(selector).click()

    def home(self):
        self.click('#brand')

    def import_backup(self, prefs=None, records=None):
        backup = {'format': 'econ-mc-progress', 'version': 1,
                  'records': records or {}, 'prefs': prefs or {'mode': 'Both', 'last': None}}
        self.page.locator('#importFile').set_input_files({
            'name': 'backup.json', 'mimeType': 'application/json',
            'buffer': json.dumps(backup).encode()})
        # The previous import's toast can still be visible while File.text() is
        # pending. The input is cleared in finally only after this import ends.
        self.page.wait_for_function("document.querySelector('#importFile').value === '' && document.querySelector('#toast').textContent.includes('imported')")

    def open_question(self, question):
        self.import_backup({'mode': 'Both', 'last': question['id']})
        self.click('[data-action="resume"]')
        self.assertEqual(self.page.locator('.question-panel').get_attribute('data-question-id'), question['id'])

    def test_quiz_progress_import_and_mobile(self):
        page = self.page
        self.assertEqual(page.locator('.count-highlight').inner_text(), '1,336 questions available')
        self.assertEqual(page.locator('.topic-card').count(), 9)
        # Home loads metadata only, with no scan downloads.
        self.assertEqual(page.evaluate("performance.getEntriesByType('resource').filter(r=>r.name.includes('/assets/scans/')).length"), 0)
        self.click('[data-mode="CE"]')
        empty = page.locator('[data-topic="5"]')
        self.assertEqual(empty.get_attribute('aria-disabled'), 'true')
        empty.click(force=True)
        self.assertEqual(page.locator('.topic-card').count(), 9)
        empty.dispatch_event('keydown', {'key': 'Enter'})
        self.assertEqual(page.locator('.topic-card').count(), 9)
        self.click('[data-mode="AL"]')
        self.assertIn('1 QUESTION', page.locator('[data-topic="4"] .topic-qty').inner_text())
        self.assertNotIn('1 QUESTIONS', page.locator('[data-topic="4"] .topic-qty').inner_text())
        self.click('[data-mode="Both"]')
        self.click('[data-action="firstTodo"]')
        self.assertEqual(page.locator('.question-panel > .kicker').inner_text(), 'TOPIC Q1')
        self.assertNotIn('[1997 Q1]', page.locator('[data-answer="D"]').inner_text())
        self.click('[data-answer="A"]')
        self.assertIn('correct answer is C', page.locator('.feedback').inner_text())
        self.assertEqual(page.locator('.option:disabled').count(), 4)
        page.reload()
        self.click('[data-action="reviewWrong"]')
        self.click('[data-action="clearAnswer"]')
        self.click('[data-answer="C"]')
        self.assertIn('Correct', page.locator('.feedback').inner_text())
        self.click('[data-action="next"]')
        self.home()
        self.assertTrue(page.locator('[data-action="reviewWrong"]').is_disabled())
        self.click('[data-action="resume"]')
        self.click('[data-action="next"]')
        self.home()
        self.assertEqual(page.evaluate("JSON.parse(localStorage.getItem('econ-mc-prefs-v1')).last"), 't1s1q2')
        self.click('#settingsBtn')
        with page.expect_download() as event:
            self.click('[data-action="export"]')
        backup = json.loads(Path(event.value.path()).read_text())
        self.assertEqual(backup['prefs']['last'], 't1s1q2')
        self.click('[data-action="confirmReset"]')
        self.click('[data-action="reset"]')
        self.assertEqual(page.evaluate("JSON.parse(localStorage.getItem('econ-mc-progress-v1'))"), {})
        self.import_backup(backup['prefs'], backup['records'])
        self.click('[data-action="resume"]')
        self.assertEqual(page.locator('.question-panel').get_attribute('data-question-id'), 't1s1q2')
        # Invalid imported resume locations are cleared safely.
        self.import_backup({'mode': 'Both', 'last': 'missing-question'})
        self.assertIsNone(page.evaluate("JSON.parse(localStorage.getItem('econ-mc-prefs-v1')).last"))
        self.click('[data-topic="3"]')
        self.click('[data-section="II"]')
        self.click('[data-action="startSection"]')
        self.assertTrue(page.locator('.quiz-count').inner_text().startswith('QUESTION 1 /'))
        self.assertEqual(page.locator('.question-panel > .kicker').inner_text(), 'TOPIC Q17')
        bank = page.evaluate('window.ECON_DATA.questions')
        scan = next(q for q in bank if q['scanOptions'])
        self.open_question(scan)
        self.assertIn('Scan-based options', page.locator('.question-panel .scan-label').inner_text())
        page.locator('.figure-zone img').evaluate('(img)=>img.decode()')
        self.click('[data-action="zoom"]')
        self.assertEqual(page.locator('.source-modal').count(), 1)
        page.keyboard.press('Escape')
        # Linked questions still show the previous question's shared graph after relabeling.
        by_key = {(q['topic'], q['set'], q['number']): q for q in bank}
        shared = next(q for q in bank if q.get('hasOwnCitation') is False
                      and (prev := by_key.get((q['topic'], q['set'], q['number'] - 1)))
                      and prev['year'] == q['year'] and prev['level'] == q['level'])
        self.open_question(shared)
        page.wait_for_selector('.shared-reference img')
        page.locator('.shared-reference img').evaluate('(img)=>img.decode()')
        self.click('.shared-reference button')
        self.assertEqual(page.locator('#referenceZoom').count(), 1)
        self.click('#referenceZoom button')
        for width in [390, 1280]:
            page.set_viewport_size({'width': width, 'height': 844})
            self.assertTrue(page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
            self.home()
            self.assertTrue(page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        self.assertIn('Topics 1–9.', page.locator('footer').inner_text())
        self.assertEqual(page.request.get(self.url + 'favicon.svg').status, 200)

    def test_offline_download_failure_retry_and_refresh(self):
        page = self.page
        self.context.set_offline(True)
        page.reload()
        page.wait_for_selector('[data-topic="1"]')
        self.click('[data-action="firstTodo"]')
        self.click('[data-answer="C"]')
        self.assertIn('Correct', page.locator('.feedback').inner_text())
        self.context.set_offline(False)
        scans = page.evaluate('[...new Set(window.ECON_DATA.questions.map(q=>q.image))]')
        Handler.fail_once = '/bank/' + scans[-1]
        self.click('#settingsBtn')
        self.click('#downloadOffline')
        page.wait_for_function("document.querySelector('#offlineDetail').textContent.includes('interrupted')", timeout=120000)
        self.assertNotEqual(page.locator('#offlineStatus').inner_text().strip(), 'OFFLINE READY')
        self.assertIn('1067 / 1068', page.locator('#offlineDetail').inner_text())
        before = Handler.scan_requests
        self.click('#downloadOffline')
        page.wait_for_function("document.querySelector('#offlineStatus').textContent.trim()==='OFFLINE READY'", timeout=30000)
        self.assertEqual(Handler.scan_requests - before, 1, 'Retry should download only the missing scan')
        self.context.set_offline(True)
        self.click('[data-action="closeModal"]')
        page.reload()
        page.wait_for_selector('[data-topic="1"]')
        page.wait_for_function("document.querySelector('#offlineStatus').textContent.trim()==='OFFLINE READY'")
        # All 39 scan-based questions remain readable after an offline refresh.
        decoded = page.evaluate('''async () => {
          const scans = window.ECON_DATA.questions.filter(q=>q.scanOptions).map(q=>q.image);
          await Promise.all(scans.map(src=>new Promise((resolve,reject)=>{
            const img=new Image();img.onload=resolve;img.onerror=reject;img.src=src;
          })));
          return scans.length;
        }''')
        self.assertEqual(decoded, 39)
        scan = page.evaluate('window.ECON_DATA.questions.find(q=>q.scanOptions)')
        self.open_question(scan)
        page.locator('.figure-zone img').evaluate('(img)=>img.decode()')
        self.click('[data-answer="A"]')
        self.assertEqual(page.locator('.feedback').count(), 1)
        # A newly opened tab at the project subpath also works offline.
        tab = self.context.new_page()
        tab.goto(self.url)
        tab.wait_for_selector('[data-topic="1"]')
        self.assertEqual(tab.locator('.count-highlight').inner_text(), '1,336 questions available')


if __name__ == '__main__':
    unittest.main(verbosity=2)
