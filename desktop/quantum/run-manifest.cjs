const crypto = require('node:crypto');
const path = require('node:path');

function sha256(value) {
  if (value === undefined || value === null || value === '') return '';
  const content = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

function sha256Base64(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return sha256(Buffer.from(text, 'base64'));
}

function extractEngineVersion(engine, output, fallback = '') {
  const text = String(output || '');
  const lines = text.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  const patterns = engine === 'gaussian'
    ? [/Gaussian\s+\d+[^\r\n]*/iu, /Revision\s+[A-Z0-9.\-]+/iu]
    : engine === 'orca'
      ? [/Program\s+Version\s+\S+/iu, /ORCA\s+VERSION\s+\S+/iu]
      : engine === 'xtb'
        ? [/xtb\s+version\s+\S+/iu, /\*\s*xtb\s+version\s+\S+/iu]
        : engine === 'pyscf'
          ? [/PySCF\s+\S+/iu]
          : [];
  for (const pattern of patterns) {
    const line = lines.find((entry) => pattern.test(entry));
    if (line) return line.replace(/\s+/gu, ' ').slice(0, 180);
  }
  return String(fallback || '').trim().slice(0, 180) || 'Not reported';
}

function buildQuantumRunManifest(options) {
  const result = options.result || {};
  const inputText = String(options.inputText || options.xyz || '');
  const outputText = String(options.outputText || result.outputLog || result.outputTail || '');
  const checkpointBase64 = String(options.checkpointBase64 || '');
  const executableName = options.executablePath
    ? path.win32.basename(String(options.executablePath))
    : undefined;

  return {
    schema: 'chemvault.quantum.run.v1',
    runId: String(options.runId || ''),
    generatedAt: new Date().toISOString(),
    app: {
      name: 'ChemVault Model',
      version: String(options.appVersion || '0.0.0'),
      buildId: String(options.appBuildId || ''),
      releaseId: String(options.appReleaseId || '')
    },
    engine: {
      kind: String(result.engine || options.engine || ''),
      label: String(result.engineLabel || options.engineLabel || ''),
      version: extractEngineVersion(result.engine || options.engine, outputText, options.engineVersion),
      executableName
    },
    calculation: {
      method: String(result.method || options.method || ''),
      mode: String(result.gaussianTaskLabel || result.calculationMode || options.calculationMode || ''),
      charge: Number(options.charge) || 0,
      multiplicity: Math.max(1, Number(options.multiplicity) || 1),
      routeOptions: String(options.routeOptions || ''),
      performanceProfile: result.performanceProfile || options.performanceProfile || undefined,
      outputDetail: result.outputDetail || options.outputDetail || undefined,
      checkpointReused: Boolean(result.reusedCheckpoint || options.checkpointReused)
    },
    resources: result.resourceUsage || options.resourceUsage || undefined,
    status: {
      ok: Boolean(result.ok),
      cancelled: Boolean(result.cancelled),
      timedOut: Boolean(result.timedOut),
      warningCount: Array.isArray(result.warnings) ? result.warnings.length : 0,
      error: result.error || undefined
    },
    timing: {
      engineMs: Number(result.engineElapsedMs) || 0,
      processingMs: Number(result.postProcessingElapsedMs) || 0,
      totalMs: Number(result.elapsedMs) || 0
    },
    provenance: {
      structureSha256: sha256(options.xyz || ''),
      inputSha256: sha256(inputText),
      outputSha256: sha256(outputText),
      checkpointSha256: sha256Base64(checkpointBase64) || undefined
    },
    files: {
      input: options.inputFileName || undefined,
      output: options.outputFileName || undefined,
      checkpoint: options.checkpointFileName || undefined
    }
  };
}

module.exports = {
  buildQuantumRunManifest,
  extractEngineVersion,
  sha256,
  sha256Base64
};
