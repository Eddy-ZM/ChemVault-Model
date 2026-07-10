const fs = require('node:fs');
const path = require('node:path');

const VALID_STATUSES = new Set(['queued', 'running', 'completed', 'failed', 'cancelled', 'interrupted']);
const VALID_ENGINES = new Set(['xtb', 'pyscf', 'gaussian', 'orca']);
const VALID_MODES = new Set(['single-point', 'geometry-optimization']);
const MAX_QUEUE_ITEMS = 50;

function normalizeQueueItems(items) {
  if (!Array.isArray(items)) return [];

  return items
    .filter((item) => item && typeof item === 'object' && typeof item.id === 'string')
    .slice(-MAX_QUEUE_ITEMS)
    .map((item) => {
      const status = VALID_STATUSES.has(item.status) ? item.status : 'queued';
      return {
        id: item.id.slice(0, 160),
        createdAt: typeof item.createdAt === 'string' ? item.createdAt.slice(0, 40) : new Date().toISOString(),
        label: typeof item.label === 'string' ? item.label.slice(0, 160) : 'Quantum calculation',
        engine: VALID_ENGINES.has(item.engine) ? item.engine : 'xtb',
        engineLabel: typeof item.engineLabel === 'string' ? item.engineLabel.slice(0, 80) : 'Quantum engine',
        calculationMode: VALID_MODES.has(item.calculationMode) ? item.calculationMode : 'single-point',
        gaussianTask: typeof item.gaussianTask === 'string' ? item.gaussianTask.slice(0, 80) : undefined,
        charge: Math.max(-20, Math.min(20, Number(item.charge) || 0)),
        unpairedElectrons: Math.max(0, Math.min(20, Number(item.unpairedElectrons) || 0)),
        method: typeof item.method === 'string' ? item.method.slice(0, 120) : 'gfn2',
        basisSet: typeof item.basisSet === 'string' ? item.basisSet.slice(0, 120) : undefined,
        routeOptions: typeof item.routeOptions === 'string' ? item.routeOptions.slice(0, 1000) : undefined,
        status: status === 'running' ? 'interrupted' : status,
        message: status === 'running'
          ? 'Interrupted when ChemVault closed. Review the setup and run this task again.'
          : typeof item.message === 'string'
            ? item.message.slice(0, 1000)
            : undefined
      };
    });
}

async function readQueueJournal(filePath) {
  try {
    const parsed = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
    return normalizeQueueItems(parsed?.items);
  } catch {
    return [];
  }
}

async function writeQueueJournal(filePath, items) {
  const normalized = normalizeQueueItems(items);
  const directory = path.dirname(filePath);
  const temporaryPath = `${filePath}.tmp`;
  await fs.promises.mkdir(directory, { recursive: true });
  await fs.promises.writeFile(temporaryPath, JSON.stringify({
    schema: 'chemvault.quantum.queue.v1',
    updatedAt: new Date().toISOString(),
    items: normalized
  }, null, 2), 'utf8');
  await fs.promises.rename(temporaryPath, filePath);
  return normalized;
}

module.exports = {
  MAX_QUEUE_ITEMS,
  normalizeQueueItems,
  readQueueJournal,
  writeQueueJournal
};
