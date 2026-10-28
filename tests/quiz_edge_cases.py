"""Regression checks for saved-state validation and keyboard access."""
import json
from pathlib import Path
import unittest
import browser as support


class QuizEdgeCases(unittest.TestCase):
    setUpClass = classmethod(support.BrowserChecks.setUpClass.__func__)
    tearDownClass = classmethod(support.BrowserChecks.tearDownClass.__func__)
    click = support.BrowserChecks.click
    home = support.BrowserChecks.home
    import_backup = support.BrowserChecks.import_backup
    open_question = support.BrowserChecks.open_question

    def setUp(self):
        self.context = self.browser.new_context(service_workers='block')
        self.page = self.context.new_page()
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.goto(self.url)
        self.page.wait_for_selector('[data-topic="1"]')

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])

    def test_invalid_saved_state_recovers_without_losing_valid_answers(self):
        for raw in ['null', '[]', '"bad state"', '{']:
            self.page.evaluate('(raw)=>localStorage.setItem("econ-mc-progress-v1",raw)', raw)
            self.page.reload()
            self.page.wait_for_selector('[data-topic="1"]', timeout=5000)
            self.assertEqual(self.page.locator('.stat-num').first.inner_text(), '0 / 1336')
        self.page.evaluate('''() => localStorage.setItem('econ-mc-progress-v1', JSON.stringify({
            t1s1q1:{choice:'C',time:'2026-10-22T00:00:00Z'},
            t1s1q2:{choice:['D']}, t1s1q3:{choice:'<b>bad</b>'}, stale:{choice:'A'}
        }))''')
        self.page.reload()
        self.assertEqual(self.page.locator('.stat-num').first.inner_text(), '1 / 1336')
        self.click('[data-action="firstTodo"]')
        self.assertEqual(self.page.locator('.question-panel').get_attribute('data-question-id'), 't1s1q2')
        self.click('[data-answer="D"]')
        self.assertIn('Correct', self.page.locator('.feedback').inner_text())

    def test_import_discards_non_string_choices_and_rejects_future_formats(self):
        self.import_backup(records={'t1s1q1': {'choice':'C'}, 't1s1q2': {'choice':['D']}, 'stale': {'choice':'A'}})
        records = self.page.evaluate("JSON.parse(localStorage.getItem('econ-mc-progress-v1'))")
        self.assertEqual(list(records), ['t1s1q1'])
        self.page.locator('#importFile').set_input_files({
            'name':'future.json','mimeType':'application/json',
            'buffer':json.dumps({'format':'econ-mc-progress','version':2,'records':{}}).encode()})
        self.page.wait_for_function("document.querySelector('#importFile').value === '' && document.querySelector('#toast').textContent.includes('Unable to import')")
        self.assertEqual(self.page.evaluate("JSON.parse(localStorage.getItem('econ-mc-progress-v1'))"), records)

    def test_browser_shortcuts_do_not_answer_and_option_names_are_complete(self):
        self.click('[data-action="firstTodo"]')
        copy = self.page.locator('[data-answer="A"] .option-copy').inner_text()
        self.assertEqual(self.page.locator('[data-answer="A"]').get_attribute('aria-label'), 'Option A: ' + copy)
        self.page.keyboard.press('Control+a')
        self.assertEqual(self.page.locator('.feedback').count(), 0)
        self.page.keyboard.press('c')
        self.assertIn('Correct', self.page.locator('.feedback').inner_text())

    def test_settings_focus_stays_in_dialog_and_returns_to_opener(self):
        self.click('#settingsBtn')
        self.assertTrue(self.page.evaluate("!!document.activeElement.closest('[role=dialog]')"))
        self.page.locator('[data-action="export"]').focus()
        self.page.keyboard.press('Shift+Tab')
        self.assertTrue(self.page.evaluate("!!document.activeElement.closest('[role=dialog]')"))
        self.page.keyboard.press('Escape')
        self.assertEqual(self.page.evaluate('document.activeElement.id'), 'settingsBtn')

    def test_shared_scan_blocks_quiz_keys_and_restores_focus(self):
        shared = self.page.evaluate('''() => {
          const qs=window.ECON_DATA.questions;
          return qs.find(q=>q.hasOwnCitation===false && qs.some(p=>p.topic===q.topic && p.set===q.set && p.number===q.number-1 && p.year===q.year && p.level===q.level));
        }''')
        self.open_question(shared)
        self.click('.shared-reference button')
        self.page.keyboard.press('a')
        self.assertEqual(self.page.locator('.feedback').count(), 0)
        self.page.keyboard.press('ArrowRight')
        self.assertEqual(self.page.locator('.question-panel').get_attribute('data-question-id'), shared['id'])
        self.page.keyboard.press('Tab')
        self.assertEqual(self.page.evaluate('document.activeElement.parentElement.parentElement.id'), 'referenceZoom')
        self.page.keyboard.press('Escape')
        self.assertEqual(self.page.locator('#referenceZoom').count(), 0)
        self.assertTrue(self.page.locator('.shared-reference button').evaluate('(button)=>button===document.activeElement'))

    def test_stale_tab_writes_preserve_other_tabs_answers(self):
        second = self.context.new_page()
        # Delay cross-tab notifications to cover a write before their delivery.
        second.add_init_script("window.addEventListener('storage', e=>e.stopImmediatePropagation())")
        second.goto(self.url)
        self.click('[data-action="firstTodo"]')
        second.locator('[data-action="firstTodo"]').click()
        second.locator('[data-action="next"]').click()
        self.click('[data-answer="C"]')
        second.locator('[data-answer="D"]').click()
        saved = self.page.evaluate("JSON.parse(localStorage.getItem('econ-mc-progress-v1'))")
        self.assertEqual(saved['t1s1q1']['choice'], 'C')
        self.assertEqual(saved['t1s1q2']['choice'], 'D')

    def test_failed_saves_keep_answers_for_navigation_and_export(self):
        self.page.evaluate('''() => {
          window.originalSetItem=Storage.prototype.setItem;
          Storage.prototype.setItem=function(key,value){
            if(key==='econ-mc-progress-v1')throw new DOMException('Storage full','QuotaExceededError');
            return window.originalSetItem.call(this,key,value);
          };
        }''')
        self.click('[data-action="firstTodo"]')
        self.click('[data-answer="C"]')
        self.click('[data-action="next"]')
        self.click('[data-action="prev"]')
        self.assertIn('Correct', self.page.locator('.feedback').inner_text())
        self.click('#settingsBtn')
        with self.page.expect_download() as event:
            self.click('[data-action="export"]')
        backup = json.loads(Path(event.value.path()).read_text())
        self.assertEqual(backup['records']['t1s1q1']['choice'], 'C')
        self.click('[data-action="closeModal"]')
        self.page.evaluate('() => { Storage.prototype.setItem=window.originalSetItem; }')
        self.click('[data-action="next"]')
        self.assertEqual(self.page.evaluate("JSON.parse(localStorage.getItem('econ-mc-progress-v1')).t1s1q1.choice"), 'C')

    def test_incomplete_source_scans_are_labeled_and_explained(self):
        for qid in ['t6s1q140', 't6s1q214']:
            with self.subTest(question=qid):
                question = self.page.evaluate('(id)=>window.ECON_DATA.questions.find(q=>q.id===id)', qid)
                self.open_question(question)
                warning = self.page.locator('.source-issue').inner_text()
                self.assertIn('Incomplete source scan.', warning)
                self.assertIn('Skip this question', warning)
                self.click('[data-action="quizBack"]')
                self.assertIn('Incomplete scan', self.page.locator(f'[data-question="{qid}"]').inner_text())


if __name__ == '__main__':
    unittest.main(verbosity=2)
