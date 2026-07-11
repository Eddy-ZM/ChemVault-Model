import type { QuantumCalculationResult, QuantumEngineKind, QuantumRunManifest } from '@/lib/chem/quantumTypes';
import type { QuantumHistoryMetadata, QuantumPreflightResult, QuantumResultDiagnosis } from '@/lib/chem/quantumWorkflow';

export type QuantumProjectCalculation = {
  id: string;
  createdAt: string;
  engine: QuantumEngineKind;
  engineLabel: string;
  engineVersion?: string;
  method: string;
  mode: string;
  status: 'completed' | 'failed' | 'needs-review';
  energyHartree: number | null;
  dipoleDebye: number | null;
  atomCount: number;
  charge: number;
  unpairedElectrons: number;
  warningsCount: number;
  diagnosisTitle: string;
  completenessScore?: number;
  runManifest?: QuantumRunManifest;
};

export type QuantumProjectRecord = {
  id: string;
  lookupKey: string;
  createdAt: string;
  updatedAt: string;
  moleculeName: string;
  identifier?: string;
  formula?: string | null;
  smiles?: string | null;
  calculationCount: number;
  latestEngineLabel: string;
  latestStatus: QuantumProjectCalculation['status'];
  latestEnergyHartree: number | null;
  latestDipoleDebye: number | null;
  calculations: QuantumProjectCalculation[];
};

export type QuantumProjectBundle = {
  schema: 'chemvault.quantum.project.v1';
  exportedAt: string;
  copyright: string;
  project: QuantumProjectRecord;
};

const PROJECTS_KEY = 'chemvault.model.quantumProjects.v1';
const PROJECT_LIMIT = 30;
const CALCULATIONS_PER_PROJECT_LIMIT = 40;
const CHEMVAULT_COPYRIGHT_NOTICE = 'Copyright (c) ChemVault. All rights reserved.';

export function loadQuantumProjects(): QuantumProjectRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PROJECTS_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isProjectRecord).map(normalizeProjectRecord).slice(0, PROJECT_LIMIT);
  } catch {
    return [];
  }
}

export async function hydrateQuantumProjects(): Promise<QuantumProjectRecord[]> {
  const cached = loadQuantumProjects();
  const api = typeof window !== 'undefined' ? window.chemVaultDesktop : undefined;
  if (!api?.getQuantumProjects) return cached;
  try {
    const persisted = await api.getQuantumProjects();
    const merged = mergeProjects(persisted, cached);
    cacheQuantumProjects(merged);
    if (merged.length !== persisted.length || (persisted.length === 0 && cached.length > 0)) {
      await api.saveQuantumProjects(merged);
    }
    return merged;
  } catch {
    return cached;
  }
}

export async function saveQuantumProjectFromCalculation(options: {
  charge: number;
  diagnosis: QuantumResultDiagnosis;
  metadata?: QuantumHistoryMetadata;
  preflight: QuantumPreflightResult;
  result: QuantumCalculationResult;
  unpairedElectrons: number;
}): Promise<QuantumProjectRecord[]> {
  const calculation = projectCalculationFromResult(options);
  const key = projectKey(options.metadata);
  const now = new Date().toISOString();
  const projects = loadQuantumProjects();
  const existing = projects.find((project) => (project.lookupKey || projectRecordKey(project)) === key);
  const nextProject: QuantumProjectRecord = existing
    ? {
        ...existing,
        updatedAt: now,
        calculationCount: existing.calculationCount + 1,
        latestEngineLabel: calculation.engineLabel,
        latestStatus: calculation.status,
        latestEnergyHartree: calculation.energyHartree,
        latestDipoleDebye: calculation.dipoleDebye,
        calculations: [calculation, ...existing.calculations.filter((item) => item.id !== calculation.id)].slice(0, CALCULATIONS_PER_PROJECT_LIMIT)
      }
    : {
        id: `qproj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        lookupKey: key,
        createdAt: now,
        updatedAt: now,
        moleculeName: moleculeName(options.metadata),
        identifier: moleculeIdentifier(options.metadata),
        formula: options.metadata?.formula ?? null,
        smiles: options.metadata?.smiles ?? null,
        calculationCount: 1,
        latestEngineLabel: calculation.engineLabel,
        latestStatus: calculation.status,
        latestEnergyHartree: calculation.energyHartree,
        latestDipoleDebye: calculation.dipoleDebye,
        calculations: [calculation]
      };

  const nextProjects = [nextProject, ...projects.filter((project) => project.id !== nextProject.id)]
    .sort((first, second) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt))
    .slice(0, PROJECT_LIMIT);

  await persistQuantumProjects(nextProjects);
  return nextProjects;
}

export function exportQuantumProjectBundle(project: QuantumProjectRecord): string {
  const bundle: QuantumProjectBundle = {
    schema: 'chemvault.quantum.project.v1',
    exportedAt: new Date().toISOString(),
    copyright: CHEMVAULT_COPYRIGHT_NOTICE,
    project: normalizeProjectRecord(project)
  };
  return JSON.stringify(bundle, null, 2);
}

export async function importQuantumProjectBundle(content: string): Promise<QuantumProjectRecord[]> {
  const parsed = JSON.parse(content) as Partial<QuantumProjectBundle> | QuantumProjectRecord;
  const project = 'schema' in parsed ? parsed.project : parsed;
  if (!isProjectRecord(project)) {
    throw new Error('This file is not a valid ChemVault quantum project bundle.');
  }

  const projects = loadQuantumProjects();
  const normalized: QuantumProjectRecord = {
    ...project,
    lookupKey: project.lookupKey || projectRecordKey(project),
    updatedAt: new Date().toISOString(),
    calculations: normalizeProjectRecord(project).calculations.slice(0, CALCULATIONS_PER_PROJECT_LIMIT),
    calculationCount: Math.max(project.calculationCount, project.calculations.length)
  };
  const nextProjects = [normalized, ...projects.filter((item) => item.id !== normalized.id)]
    .sort((first, second) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt))
    .slice(0, PROJECT_LIMIT);

  await persistQuantumProjects(nextProjects);
  return nextProjects;
}

export async function clearQuantumProjects() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(PROJECTS_KEY);
    await window.chemVaultDesktop?.saveQuantumProjects?.([]);
  }
  return [];
}

async function persistQuantumProjects(projects: QuantumProjectRecord[]) {
  let cacheError: unknown = null;
  try {
    cacheQuantumProjects(projects);
  } catch (error) {
    cacheError = error;
  }
  const desktopSave = typeof window !== 'undefined' ? window.chemVaultDesktop?.saveQuantumProjects : undefined;
  if (desktopSave) {
    await desktopSave(projects);
    return;
  }
  if (cacheError) throw cacheError;
}

function cacheQuantumProjects(projects: QuantumProjectRecord[]) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  }
}

function mergeProjects(primary: QuantumProjectRecord[], secondary: QuantumProjectRecord[]) {
  const byId = new Map<string, QuantumProjectRecord>();
  for (const project of [...primary, ...secondary]) {
    if (!isProjectRecord(project)) continue;
    const normalized = normalizeProjectRecord(project);
    const current = byId.get(normalized.id);
    if (!current || Date.parse(normalized.updatedAt) > Date.parse(current.updatedAt)) byId.set(normalized.id, normalized);
  }
  return [...byId.values()]
    .sort((first, second) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt))
    .slice(0, PROJECT_LIMIT);
}

function projectCalculationFromResult(options: {
  charge: number;
  diagnosis: QuantumResultDiagnosis;
  preflight: QuantumPreflightResult;
  result: QuantumCalculationResult;
  unpairedElectrons: number;
}): QuantumProjectCalculation {
  const { diagnosis, preflight, result } = options;
  return {
    id: `qrun_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    createdAt: new Date().toISOString(),
    engine: result.engine,
    engineLabel: result.engineLabel,
    engineVersion: result.engineVersion,
    method: result.method,
    mode: result.gaussianTaskLabel || result.calculationMode,
    status: result.ok && diagnosis.severity === 'success' ? 'completed' : result.ok ? 'needs-review' : 'failed',
    energyHartree: result.energyHartree,
    dipoleDebye: result.dipoleDebye?.total ?? null,
    atomCount: preflight.atomCount,
    charge: options.charge,
    unpairedElectrons: options.unpairedElectrons,
    warningsCount: result.warnings.length,
    diagnosisTitle: diagnosis.title,
    completenessScore: diagnosis.completenessScore,
    runManifest: result.runManifest
  };
}

function projectKey(metadata?: QuantumHistoryMetadata | QuantumProjectRecord) {
  if (!metadata) return 'unknown';
  if ('moleculeName' in metadata) return projectRecordKey(metadata);
  return [
    metadata.pdbId ? `pdb:${metadata.pdbId}` : '',
    metadata.cid ? `cid:${metadata.cid}` : '',
    metadata.smiles ? `smiles:${metadata.smiles}` : '',
    metadata.fileName ? `file:${metadata.fileName}` : '',
    metadata.name ? `name:${metadata.name}` : ''
  ].filter(Boolean)[0] || 'unknown';
}

function projectRecordKey(project: QuantumProjectRecord) {
  return [
    project.identifier ? `identifier:${project.identifier}` : '',
    project.smiles ? `smiles:${project.smiles}` : '',
    project.moleculeName ? `name:${project.moleculeName}` : ''
  ].filter(Boolean)[0] || project.id;
}

function moleculeName(metadata?: QuantumHistoryMetadata) {
  return metadata?.name || metadata?.pdbId || metadata?.cid || metadata?.fileName || metadata?.smiles || 'Unnamed molecule';
}

function moleculeIdentifier(metadata?: QuantumHistoryMetadata) {
  if (metadata?.pdbId) return `PDB ${metadata.pdbId}`;
  if (metadata?.cid) return `CID ${metadata.cid}`;
  if (metadata?.fileName) return metadata.fileName;
  return metadata?.smiles || undefined;
}

function isProjectRecord(value: unknown): value is QuantumProjectRecord {
  const record = value as QuantumProjectRecord;
  return Boolean(
    record
    && typeof record.id === 'string'
    && typeof record.createdAt === 'string'
    && typeof record.updatedAt === 'string'
    && typeof record.moleculeName === 'string'
    && Array.isArray(record.calculations)
  );
}

function normalizeProjectRecord(record: QuantumProjectRecord): QuantumProjectRecord {
  return {
    ...record,
    calculations: record.calculations.map((calculation) => {
      const legacy = calculation as QuantumProjectCalculation & { qualityScore?: number };
      const { qualityScore, ...current } = legacy;
      return {
        ...current,
        completenessScore: typeof current.completenessScore === 'number' ? current.completenessScore : qualityScore
      };
    })
  };
}
