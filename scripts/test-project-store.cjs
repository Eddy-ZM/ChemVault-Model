const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { normalizeProjectRecords, readProjectStore, writeProjectStore } = require('../desktop/quantum/project-store.cjs');

const sample = {
  id: 'project-1',
  lookupKey: 'water',
  createdAt: '2026-07-11T00:00:00.000Z',
  updatedAt: '2026-07-11T00:00:00.000Z',
  moleculeName: 'Water',
  calculationCount: 1,
  latestEngineLabel: 'Gaussian',
  latestStatus: 'completed',
  latestEnergyHartree: -76.4,
  latestDipoleDebye: 1.8,
  calculations: [{ id: 'run-1', status: 'completed' }]
};

assert.equal(normalizeProjectRecords([sample])[0].moleculeName, 'Water');
assert.deepEqual(normalizeProjectRecords([{ invalid: true }]), []);

(async () => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'chemvault-project-store-'));
  const filePath = path.join(directory, 'quantum-projects.json');
  await writeProjectStore(filePath, [sample]);
  assert.equal((await readProjectStore(filePath))[0].id, 'project-1');
  await writeProjectStore(filePath, [{ ...sample, moleculeName: 'Water updated' }]);
  assert.equal((await readProjectStore(filePath))[0].moleculeName, 'Water updated');
  assert.equal(fs.existsSync(`${filePath}.backup`), true);
  await fs.promises.rm(directory, { recursive: true, force: true });
  console.log('Quantum project store tests passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
