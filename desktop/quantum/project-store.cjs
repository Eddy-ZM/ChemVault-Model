const fs = require('node:fs');
const path = require('node:path');

const MAX_PROJECTS = 30;
const MAX_CALCULATIONS_PER_PROJECT = 40;
const MAX_STORE_BYTES = 5 * 1024 * 1024;

function normalizeProjectRecords(records) {
  if (!Array.isArray(records)) return [];
  return records
    .filter((record) => record && typeof record === 'object' && typeof record.id === 'string' && Array.isArray(record.calculations))
    .slice(0, MAX_PROJECTS)
    .map((record) => ({
      ...jsonClone(record),
      id: record.id.slice(0, 160),
      lookupKey: stringValue(record.lookupKey, 320),
      createdAt: stringValue(record.createdAt, 40),
      updatedAt: stringValue(record.updatedAt, 40),
      moleculeName: stringValue(record.moleculeName, 160) || 'Untitled molecule',
      calculationCount: Math.max(0, Math.min(100000, Number(record.calculationCount) || record.calculations.length)),
      calculations: record.calculations
        .filter((item) => item && typeof item === 'object' && typeof item.id === 'string')
        .slice(0, MAX_CALCULATIONS_PER_PROJECT)
        .map((item) => jsonClone(item))
    }));
}

async function readProjectStore(filePath) {
  try {
    const parsed = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
    return normalizeProjectRecords(parsed?.projects);
  } catch {
    return [];
  }
}

async function writeProjectStore(filePath, records) {
  const projects = normalizeProjectRecords(records);
  const payload = JSON.stringify({
    schema: 'chemvault.quantum.projects.v1',
    updatedAt: new Date().toISOString(),
    projects
  }, null, 2);
  if (Buffer.byteLength(payload, 'utf8') > MAX_STORE_BYTES) {
    throw new Error('Quantum project workspace exceeds the 5 MB local storage limit. Export or remove older records.');
  }

  const directory = path.dirname(filePath);
  const temporaryPath = `${filePath}.tmp`;
  const backupPath = `${filePath}.backup`;
  await fs.promises.mkdir(directory, { recursive: true });
  await fs.promises.writeFile(temporaryPath, payload, 'utf8');
  try {
    await fs.promises.copyFile(filePath, backupPath);
  } catch {
    // The first write has no previous file to back up.
  }
  await fs.promises.rename(temporaryPath, filePath);
  return projects;
}

function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stringValue(value, maximumLength) {
  return typeof value === 'string' ? value.slice(0, maximumLength) : '';
}

module.exports = {
  MAX_CALCULATIONS_PER_PROJECT,
  MAX_PROJECTS,
  normalizeProjectRecords,
  readProjectStore,
  writeProjectStore
};
