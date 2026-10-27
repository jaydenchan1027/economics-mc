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

test('no stem, context, or option contains a leaked question citation', () => {
  for (const q of questions) {
    assert.match(q.answer, /^[ABCD]$/);
    for (const text of [q.stem, q.context, ...Object.values(q.options)]) {
      // Source citations can include AL, combined questions, or "modified",
      // and a leaked shared-question preamble can follow the closing bracket.
      assert.doesNotMatch(text, /\[(?:AL\s*)?(?:19|20)\d{2}\s*Q\d+[^\]]*\]/, q.id);
    }
  }
});

test('shared-question preambles stay with their own questions', () => {
  const byId = new Map(questions.map(q => [q.id, q]));
  assert.equal(byId.get('t2s1q146').options.D, 'avoiding the existence of diseconomies of scale.');
  assert.equal(byId.get('t2s1q148').options.D, 'diversifying the risk of business.');
  assert.match(byId.get('t2s1q147').context, /^The MTR Corporation launched the Octopus Card\./);
  assert.match(byId.get('t2s1q149').context, /^A catering company owns many restaurants/);
  assert.equal(byId.get('t1s1q7').options.D, 'All of the above.');
  assert.equal(byId.get('t2s1q180').options.D,
    'Debenture holders can claim the company’s assets prior to shareholders when the company goes bankrupt.');
});

test('all 39 scan-based questions are explicitly marked', () => {
  const counts = {};
  for (const q of questions) {
    assert.equal(q.scanOptions, Object.keys(q.options).length === 0, q.id);
    if (q.scanOptions) counts[q.topic] = (counts[q.topic] || 0) + 1;
  }
  assert.deepEqual(counts, {3: 18, 6: 8, 7: 2, 8: 6, 9: 5});
});

test('known clipped source scans are identified without inventing option text', () => {
  const incomplete = questions.filter(q => q.sourceIssue);
  assert.deepEqual(Array.from(incomplete, q => q.id), ['t6s1q140', 't6s1q214']);
  for (const q of incomplete) {
    assert.match(q.sourceIssue, /cuts off option D/);
    assert.equal(Object.keys(q.options).length, 0);
    assert.equal(q.scanOptions, true);
  }
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
