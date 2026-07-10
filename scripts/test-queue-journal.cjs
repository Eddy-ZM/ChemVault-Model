const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { normalizeQueueItems, readQueueJournal, writeQueueJournal } = require('../desktop/quantum/queue-journal.cjs');

const running = normalizeQueueItems([{ id: 'one', status: 'running', label: 'Gaussian run' }]);
assert.equal(running[0].status, 'interrupted');
assert.match(running[0].message, /Interrupted/iu);

(async () => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'chemvault-queue-test-'));
  const journal = path.join(directory, 'queue.json');
  try {
    await writeQueueJournal(journal, [{ id: 'two', status: 'queued', label: 'xTB run' }]);
    await writeQueueJournal(journal, [{ id: 'three', status: 'running', label: 'Gaussian run' }]);
    const restored = await readQueueJournal(journal);
    assert.equal(restored.length, 1);
    assert.equal(restored[0].status, 'interrupted');
  } finally {
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
  console.log('Quantum queue journal tests passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
