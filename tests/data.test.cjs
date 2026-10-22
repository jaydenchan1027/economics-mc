const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const context = {window: {}};
vm.runInNewContext(fs.readFileSync(path.join(root, 'data.js'), 'utf8'), context);
const {questions, topics} = context.window.ECON_DATA;

test('migration preserves all 1,336 question IDs, answers, and source references', () => {
  assert.equal(questions.length, 1336);
  assert.equal(Object.keys(topics).length, 9);
  assert.equal(new Set(questions.map(q => q.id)).size, 1336);
  assert.equal(questions.filter(q => q.level === 'CE').length, 1043);
  assert.equal(questions.filter(q => q.level === 'AL').length, 293);
  const stable = questions.map(({id,topic,set,number,section,year,paperQ,level,answer}) =>
    ({id,topic,set,number,section,year,paperQ,level,answer}));
  // Captured from the original combined bank, before the report fixes.
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(stable)).digest('hex'),
    '1842b8766cfb481e5260c9795c275f17bd4c89e3d45c77a7d1684ea2ba60c23f');
});

test('no option contains a trailing next-question citation', () => {
  for (const q of questions) {
    assert.match(q.answer, /^[ABCD]$/);
    for (const text of Object.values(q.options)) {
      assert.doesNotMatch(text, /\[(?:19|20)\d{2} Q\d+\]\s*$/, q.id);
    }
  }
});

test('all 39 scan-based questions are explicitly marked', () => {
  const counts = {};
  for (const q of questions) {
    assert.equal(q.scanOptions, Object.keys(q.options).length === 0, q.id);
    if (q.scanOptions) counts[q.topic] = (counts[q.topic] || 0) + 1;
  }
  assert.deepEqual(counts, {3: 18, 6: 8, 7: 2, 8: 6, 9: 5});
});

test('every scan and shared reference resolves to a content-addressed WebP file', () => {
  const files = new Set();
  for (const q of questions) {
    for (const key of ['image', 'contextImage']) {
      if (!q[key]) continue;
      assert.match(q[key], /^assets\/scans\/[a-f0-9]{24}\.webp$/);
      const bytes = fs.readFileSync(path.join(root, q[key]));
      assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
      assert.ok(q[key].includes(crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 24)));
      files.add(q[key]);
    }
  }
  assert.equal(files.size, 1068);
  assert.ok(fs.statSync(path.join(root, 'data.js')).size < 1_100_000);
  const manifestContext = {self: {}};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'offline-manifest.js'), 'utf8'), manifestContext);
  const manifest = manifestContext.self.ECON_OFFLINE_MANIFEST;
  assert.deepEqual([...manifest.scans].sort(), [...files].sort());
  const digest = crypto.createHash('sha256');
  for (const name of [...manifest.shell, 'sw.js', ...manifest.scans]) {
    digest.update(name);
    digest.update(fs.readFileSync(path.join(root, name)));
  }
  assert.equal(manifest.version, digest.digest('hex').slice(0, 16), 'Run scripts/update-cache.py after app changes');
});
