import type {
  GaussianTaskTemplateId,
  QuantumCalculationMode,
  QuantumCalculationResult,
  QuantumEngineKind
} from '@/lib/chem/quantumTypes';

export type QuantumWorkflowIssue = {
  severity: 'error' | 'warning' | 'info';
  title: string;
  detail: string;
  action?: string;
};

export type QuantumWorkflowAtom = {
  atomicNumber: number;
  element: string;
  index: number;
  x: number;
  y: number;
  z: number;
};

export type QuantumPreparationStep = {
  status: 'required' | 'recommended' | 'ready';
  title: string;
  detail: string;
};

export type QuantumPreflightResult = {
  atomCount: number;
  atoms: QuantumWorkflowAtom[];
  canRun: boolean;
  issueCount: {
    errors: number;
    warnings: number;
    info: number;
  };
  issues: QuantumWorkflowIssue[];
  multiplicity: number;
  preparationSteps: QuantumPreparationStep[];
  totalElectrons: number | null;
};

export type QuantumResultDiagnosis = {
  qualityFactors?: string[];
  qualityScore?: number;
  severity: 'success' | 'warning' | 'error';
  title: string;
  summary: string;
  highlights: string[];
  suggestedActions: string[];
};

export type QuantumHistoryEntry = {
  id: string;
  createdAt: string;
  moleculeName: string;
  identifier?: string;
  formula?: string | null;
  smiles?: string | null;
  engine: QuantumEngineKind;
  engineLabel: string;
  method: string;
  mode: string;
  status: 'completed' | 'failed' | 'needs-review';
  energyHartree: number | null;
  dipoleDebye: number | null;
  charge: number;
  unpairedElectrons: number;
  atomCount: number;
  warningsCount: number;
  diagnosisTitle: string;
  qualityScore?: number;
};

export type QuantumHistoryMetadata = {
  cid?: string | null;
  fileName?: string | null;
  formula?: string | null;
  name?: string;
  pdbId?: string | null;
  smiles?: string | null;
};

const HISTORY_KEY = 'chemvault.model.quantumHistory.v1';
const HISTORY_LIMIT = 40;

const ATOMIC_NUMBERS: Record<string, number> = {
  H: 1,
  He: 2,
  Li: 3,
  Be: 4,
  B: 5,
  C: 6,
  N: 7,
  O: 8,
  F: 9,
  Ne: 10,
  Na: 11,
  Mg: 12,
  Al: 13,
  Si: 14,
  P: 15,
  S: 16,
  Cl: 17,
  Ar: 18,
  K: 19,
  Ca: 20,
  Sc: 21,
  Ti: 22,
  V: 23,
  Cr: 24,
  Mn: 25,
  Fe: 26,
  Co: 27,
  Ni: 28,
  Cu: 29,
  Zn: 30,
  Ga: 31,
  Ge: 32,
  As: 33,
  Se: 34,
  Br: 35,
  Kr: 36,
  Rb: 37,
  Sr: 38,
  Y: 39,
  Zr: 40,
  Nb: 41,
  Mo: 42,
  Tc: 43,
  Ru: 44,
  Rh: 45,
  Pd: 46,
  Ag: 47,
  Cd: 48,
  In: 49,
  Sn: 50,
  Sb: 51,
  Te: 52,
  I: 53,
  Xe: 54,
  Cs: 55,
  Ba: 56,
  La: 57,
  Ce: 58,
  Pr: 59,
  Nd: 60,
  Pm: 61,
  Sm: 62,
  Eu: 63,
  Gd: 64,
  Tb: 65,
  Dy: 66,
  Ho: 67,
  Er: 68,
  Tm: 69,
  Yb: 70,
  Lu: 71,
  Hf: 72,
  Ta: 73,
  W: 74,
  Re: 75,
  Os: 76,
  Ir: 77,
  Pt: 78,
  Au: 79,
  Hg: 80,
  Tl: 81,
  Pb: 82,
  Bi: 83,
  Po: 84,
  At: 85,
  Rn: 86,
  Fr: 87,
  Ra: 88,
  Ac: 89,
  Th: 90,
  Pa: 91,
  U: 92,
  Np: 93,
  Pu: 94,
  Am: 95,
  Cm: 96,
  Bk: 97,
  Cf: 98,
  Es: 99,
  Fm: 100,
  Md: 101,
  No: 102,
  Lr: 103,
  Rf: 104,
  Db: 105,
  Sg: 106,
  Bh: 107,
  Hs: 108,
  Mt: 109,
  Ds: 110,
  Rg: 111,
  Cn: 112,
  Nh: 113,
  Fl: 114,
  Mc: 115,
  Lv: 116,
  Ts: 117,
  Og: 118
};

const COVALENT_RADIUS: Record<string, number> = {
  H: 0.31,
  B: 0.85,
  C: 0.76,
  N: 0.71,
  O: 0.66,
  F: 0.57,
  P: 1.07,
  S: 1.05,
  Cl: 1.02,
  Br: 1.2,
  I: 1.39,
  Na: 1.66,
  Mg: 1.41,
  K: 2.03,
  Ca: 1.76,
  Fe: 1.24,
  Cu: 1.32,
  Zn: 1.22
};

export function validateQuantumPreflight(options: {
  basisSet?: string;
  calculationMode?: QuantumCalculationMode;
  charge: number;
  engine: QuantumEngineKind;
  gaussianTask?: GaussianTaskTemplateId;
  method?: string;
  routeOptions?: string;
  unpairedElectrons: number;
  xyz: string | null;
}): QuantumPreflightResult {
  const issues: QuantumWorkflowIssue[] = [];
  const preparationSteps: QuantumPreparationStep[] = [];
  const atoms = parseXyzAtoms(options.xyz, issues);
  const atomCount = atoms.length;
  const charge = finiteInteger(options.charge, 0);
  const unpairedElectrons = finiteInteger(options.unpairedElectrons, 0);
  const multiplicity = Math.max(1, unpairedElectrons + 1);
  const totalElectrons = atomCount > 0 ? atoms.reduce((sum, atom) => sum + atom.atomicNumber, 0) - charge : null;

  if (atomCount > 0 && totalElectrons !== null) {
    if (totalElectrons <= 0) {
      issues.push({
        severity: 'error',
        title: 'Electron count is not physical',
        detail: `The current atoms and total charge produce ${totalElectrons} electrons.`,
        action: 'Check the total charge before running the quantum engine.'
      });
    }

    if (unpairedElectrons > Math.max(totalElectrons, 0)) {
      issues.push({
        severity: 'error',
        title: 'Too many unpaired electrons',
        detail: `${unpairedElectrons} unpaired electrons cannot be assigned to ${totalElectrons} total electrons.`,
        action: 'Reduce unpaired electrons or correct the molecular charge.'
      });
    } else if ((Math.max(totalElectrons, 0) - unpairedElectrons) % 2 !== 0) {
      issues.push({
        severity: 'error',
        title: 'Charge and spin do not match',
        detail: `${totalElectrons} electrons with ${multiplicity} multiplicity is inconsistent for a standard single-reference job.`,
        action: 'Use an odd number of unpaired electrons for odd-electron systems and zero or another even value for even-electron systems.'
      });
    }

    if (Math.abs(charge) > Math.max(3, atomCount / 3)) {
      issues.push({
        severity: 'warning',
        title: 'Large formal charge',
        detail: `Total charge ${charge} is large for a ${atomCount}-atom structure.`,
        action: 'Confirm protonation, counterions, and fragment state before high-precision calculation.'
      });
    }
  }

  if (atomCount > 0) {
    const hydrogenCount = atoms.filter((atom) => atom.element === 'H').length;
    const organicHeavyAtoms = atoms.filter((atom) => ['B', 'C', 'N', 'O', 'P', 'S', 'F', 'Cl', 'Br', 'I'].includes(atom.element)).length;
    if (hydrogenCount === 0 && organicHeavyAtoms > 0) {
      issues.push({
        severity: 'warning',
        title: 'Hydrogens are absent',
        detail: 'The structure has organic or biomolecular heavy atoms but no hydrogens.',
        action: 'Add hydrogens before Gaussian or interpret charge and dipole results cautiously.'
      });
      preparationSteps.push({
        status: 'recommended',
        title: 'Add hydrogens',
        detail: 'Hydrogen completion improves charges, dipoles, frequency analysis, and Gaussian convergence.'
      });
    } else if (organicHeavyAtoms > 0) {
      preparationSteps.push({
        status: 'ready',
        title: 'Hydrogen presence',
        detail: 'Hydrogens are present in the current 3D structure.'
      });
    }

    const duplicatePair = findNearDuplicateAtoms(atoms);
    if (duplicatePair) {
      issues.push({
        severity: 'error',
        title: 'Atoms are too close',
        detail: `Atoms ${duplicatePair[0]} and ${duplicatePair[1]} are nearly overlapping.`,
        action: 'Clean or regenerate the 3D geometry before running the engine.'
      });
      preparationSteps.push({
        status: 'required',
        title: 'Clean geometry',
        detail: 'Resolve overlapping atoms before running professional engines.'
      });
    }

    const fragmentCount = estimateFragmentCount(atoms);
    if (fragmentCount > 1) {
      issues.push({
        severity: 'warning',
        title: 'Multiple fragments detected',
        detail: `The geometry appears to contain ${fragmentCount} disconnected fragments.`,
        action: 'Confirm salts, counterions, and separated fragments before assigning charge and multiplicity.'
      });
      preparationSteps.push({
        status: 'recommended',
        title: 'Review fragments',
        detail: 'Separated fragments often require careful charge assignment or separate calculations.'
      });
    }

    if (atomCount > 180 && options.engine === 'gaussian') {
      issues.push({
        severity: 'warning',
        title: 'Large Gaussian job',
        detail: `${atomCount} atoms can be slow with ${options.method || 'the selected method'} / ${options.basisSet || 'basis set'}.`,
        action: 'Consider xTB screening, a smaller fragment, or a lower-cost template before full Gaussian refinement.'
      });
      preparationSteps.push({
        status: 'recommended',
        title: 'Screen before high precision',
        detail: 'Run xTB screening or fragment selection before a large Gaussian job.'
      });
    } else if (atomCount > 300) {
      issues.push({
        severity: 'warning',
        title: 'Large structure',
        detail: `${atomCount} atoms may exceed the practical size of the selected local workflow.`,
        action: 'Use a smaller active region or a semiempirical pre-screening step.'
      });
    }

    preparationSteps.push({
      status: options.engine === 'gaussian' ? 'recommended' : 'ready',
      title: 'Conformer and protonation review',
      detail: options.engine === 'gaussian'
        ? 'For publication-grade Gaussian results, confirm conformer, stereochemistry, and protonation state before the final job.'
        : 'Current structure is usable for screening; confirm conformer and protonation before final Gaussian refinement.'
    });
  }

  if (options.engine === 'gaussian') {
    const routeOptions = String(options.routeOptions || '');
    if (!/pop\s*=/iu.test(routeOptions)) {
      issues.push({
        severity: 'info',
        title: 'Population analysis not requested',
        detail: 'Gaussian may not return Mulliken charges unless the route includes a population analysis keyword.',
        action: 'Keep Pop=Full when you want ChemVault to parse partial charges.'
      });
    }

    if (options.gaussianTask === 'frequency' && options.calculationMode === 'single-point') {
      issues.push({
        severity: 'info',
        title: 'Frequency uses current geometry',
        detail: 'Frequency analysis will run on the loaded geometry without optimization.',
        action: 'Use Opt + Freq when you want Gaussian to optimize first.'
      });
    }

    if (options.gaussianTask === 'transition-state') {
      issues.push({
        severity: 'info',
        title: 'TS search needs a prepared guess',
        detail: 'The transition-state template assumes the current geometry is already close to a first-order saddle point.',
        action: 'Prepare the TS guess in GaussView or another editor before running this bridge template.'
      });
    }

    if (options.gaussianTask === 'irc') {
      issues.push({
        severity: 'info',
        title: 'IRC requires a transition-state geometry',
        detail: 'IRC jobs should start from a verified TS structure with exactly one imaginary frequency.',
        action: 'Run TS + frequency first, then use the optimized TS geometry for IRC.'
      });
    }

    if (options.gaussianTask === 'nbo') {
      issues.push({
        severity: 'info',
        title: 'NBO depends on local Gaussian support',
        detail: 'ChemVault can generate the NBO route, but the actual analysis depends on the user-licensed local Gaussian/NBO installation.',
        action: 'If NBO is unavailable locally, export the GJF and edit the route manually in GaussView or Gaussian tools.'
      });
    }
  }

  const issueCount = {
    errors: issues.filter((issue) => issue.severity === 'error').length,
    warnings: issues.filter((issue) => issue.severity === 'warning').length,
    info: issues.filter((issue) => issue.severity === 'info').length
  };

  return {
    atomCount,
    atoms,
    canRun: issueCount.errors === 0 && atomCount > 0,
    issueCount,
    issues,
    multiplicity,
    preparationSteps,
    totalElectrons
  };
}

export function diagnoseQuantumCalculation(
  result: QuantumCalculationResult,
  preflight?: QuantumPreflightResult
): QuantumResultDiagnosis {
  const text = `${result.error || ''}\n${result.outputLog || result.outputTail || ''}`;
  const normalized = text.toLowerCase();
  const highlights = extractLogHighlights(text);
  const suggestedActions: string[] = [];
  const quality = assessResultQuality(result, preflight);

  if (result.ok) {
    if (result.energyHartree !== null && result.dipoleDebye && result.charges.length > 0) {
      return withQuality({
        severity: 'success',
        title: 'Calculation completed and parsed',
        summary: `${result.engineLabel} returned energy, dipole vector, and ${result.charges.length} parsed partial charges.`,
        highlights,
        suggestedActions: ['Export the report or Gaussian suite, or continue with GaussView for post-processing.']
      }, quality);
    }

    if (result.energyHartree !== null) {
      if (!result.dipoleDebye) suggestedActions.push('Check whether the selected route prints dipole moments for this job type.');
      if (result.charges.length === 0) suggestedActions.push('For Gaussian, keep Pop=Full or another population analysis keyword in route options.');
      return withQuality({
        severity: 'warning',
        title: 'Calculation completed with limited parsed data',
        summary: `${result.engineLabel} completed, but ChemVault could not parse every requested property.`,
        highlights,
        suggestedActions
      }, quality);
    }
  }

  if (/charge and multiplicity|multiplicity|impossible charge|spin/iu.test(text)) {
    suggestedActions.push('Review total charge and unpaired electrons. The ChemVault preflight panel shows the electron-count check.');
    if (preflight?.totalElectrons !== null) {
      suggestedActions.push(`Current preflight estimate: ${preflight?.totalElectrons ?? 'unknown'} electrons, multiplicity ${preflight?.multiplicity ?? 'unknown'}.`);
    }
    return failureDiagnosis('Charge or spin setting failed', 'The engine reported a charge, spin, or multiplicity issue.', highlights, suggestedActions, quality);
  }

  if (/atoms too close|distance matrix|small interatomic distance|linear bend/iu.test(text)) {
    suggestedActions.push('Regenerate or clean the 3D geometry before running Gaussian again.');
    suggestedActions.push('Run a quick xTB screen or a geometry optimization before higher-level templates.');
    return failureDiagnosis('Geometry needs cleanup', 'The engine reported overlapping atoms or an invalid distance matrix.', highlights, suggestedActions, quality);
  }

  if (/convergence failure|scf has not converged|convergence criterion not met|failed to converge/iu.test(text)) {
    suggestedActions.push('Try SCF=XQC or a smaller basis set, then rerun.');
    suggestedActions.push('Use xTB or Opt first to improve the starting geometry.');
    return failureDiagnosis('SCF convergence failed', 'The electronic structure iteration did not converge cleanly.', highlights, suggestedActions, quality);
  }

  if (/basis set data|basis functions|unknown center|atomic number out of range|pseudo|ecp/iu.test(text)) {
    suggestedActions.push('Choose a basis set that supports every element in the structure.');
    suggestedActions.push('For heavy elements, use an appropriate ECP or a basis family available in your Gaussian installation.');
    return failureDiagnosis('Basis set or element mismatch', 'The selected method or basis set does not match the molecular elements.', highlights, suggestedActions, quality);
  }

  if (/license|licensed|permission|access denied|denied/iu.test(text)) {
    suggestedActions.push('Confirm the local commercial engine license and Windows permissions.');
    return failureDiagnosis('Engine license or permission issue', 'The engine started but reported an access or license problem.', highlights, suggestedActions, quality);
  }

  if (/no such file|not found|not recognized|l\d+\.exe|link 0|gauss_exedir|g16root|gauss_scrdir/iu.test(text)) {
    suggestedActions.push('Re-select the real Gaussian executable and save the port again.');
    suggestedActions.push('Check GAUSS_EXEDIR, G16ROOT, and scratch directory access.');
    return failureDiagnosis('Gaussian runtime path issue', 'Gaussian could not find a required executable, link file, or runtime path.', highlights, suggestedActions, quality);
  }

  if (/erroneous write|disk|scratch|no space|quota/iu.test(text)) {
    suggestedActions.push('Free disk space or change the Gaussian scratch directory.');
    return failureDiagnosis('Scratch or disk write issue', 'The engine could not write required temporary or checkpoint data.', highlights, suggestedActions, quality);
  }

  if (/normal termination of gaussian/iu.test(text) && result.energyHartree === null) {
    return withQuality({
      severity: 'warning',
      title: 'Normal termination found, parser needs review',
      summary: 'The log contains a Gaussian normal termination marker, but ChemVault did not find an SCF energy line.',
      highlights,
      suggestedActions: ['Export TXT and inspect the Gaussian route. Some job types may not produce the same parsed sections.']
    }, quality);
  }

  if (result.error || !result.ok) {
    suggestedActions.push('Open the calculation log and inspect the final engine messages.');
    suggestedActions.push('Try a quick xTB screen to validate the structure before a high-precision run.');
    return failureDiagnosis(
      `${result.engineLabel} calculation did not complete`,
      result.error || `${result.engineLabel} did not return a complete result.`,
      highlights,
      suggestedActions,
      quality
    );
  }

  return withQuality({
    severity: 'warning',
    title: 'Result needs review',
    summary: 'ChemVault received a result, but not all expected properties were available.',
    highlights,
    suggestedActions: result.warnings.length ? result.warnings.slice(0, 3) : ['Export the report and review the engine log.']
  }, quality);
}

export function createQuantumHistoryEntry(options: {
  charge: number;
  diagnosis: QuantumResultDiagnosis;
  metadata?: QuantumHistoryMetadata;
  preflight: QuantumPreflightResult;
  result: QuantumCalculationResult;
  unpairedElectrons: number;
}): QuantumHistoryEntry {
  const { diagnosis, metadata, preflight, result } = options;
  return {
    id: `qcalc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    createdAt: new Date().toISOString(),
    moleculeName: moleculeName(metadata),
    identifier: moleculeIdentifier(metadata),
    formula: metadata?.formula ?? null,
    smiles: metadata?.smiles ?? null,
    engine: result.engine,
    engineLabel: result.engineLabel,
    method: result.method,
    mode: result.gaussianTaskLabel || result.calculationMode,
    status: result.ok && diagnosis.severity === 'success' ? 'completed' : result.ok ? 'needs-review' : 'failed',
    energyHartree: result.energyHartree,
    dipoleDebye: result.dipoleDebye?.total ?? null,
    charge: options.charge,
    unpairedElectrons: options.unpairedElectrons,
    atomCount: preflight.atomCount,
    warningsCount: result.warnings.length,
    diagnosisTitle: diagnosis.title,
    qualityScore: diagnosis.qualityScore
  };
}

export function loadQuantumHistory(): QuantumHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HISTORY_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isQuantumHistoryEntry).slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}

export function saveQuantumHistoryEntry(entry: QuantumHistoryEntry): QuantumHistoryEntry[] {
  if (typeof window === 'undefined') return [entry];
  const current = loadQuantumHistory();
  const next = [entry, ...current.filter((item) => item.id !== entry.id)].slice(0, HISTORY_LIMIT);
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

export function clearQuantumHistory() {
  if (typeof window === 'undefined') return [];
  window.localStorage.removeItem(HISTORY_KEY);
  return [];
}

function parseXyzAtoms(xyz: string | null | undefined, issues: QuantumWorkflowIssue[]) {
  const value = String(xyz || '').trim();
  if (!value) {
    issues.push({
      severity: 'error',
      title: 'No 3D structure',
      detail: 'A 3D XYZ structure is required before running a quantum engine.',
      action: 'Load a molecule, generate 3D coordinates, or upload a structure file.'
    });
    return [];
  }

  const lines = value.split(/\r?\n/u).filter((line) => line.trim());
  const declaredCount = Number.parseInt(lines[0] || '', 10);
  if (!Number.isFinite(declaredCount) || declaredCount <= 0) {
    issues.push({
      severity: 'error',
      title: 'Invalid XYZ header',
      detail: 'The first XYZ line must contain a positive atom count.',
      action: 'Regenerate the 3D structure before calculating.'
    });
    return [];
  }

  const atomLines = lines.slice(2, 2 + declaredCount);
  if (atomLines.length < declaredCount) {
    issues.push({
      severity: 'error',
      title: 'Incomplete XYZ geometry',
      detail: `The XYZ header declares ${declaredCount} atoms but only ${atomLines.length} coordinate lines were found.`,
      action: 'Reload or regenerate the structure.'
    });
  }

  return atomLines.map((line, index) => {
    const [rawElement, rawX, rawY, rawZ] = line.trim().split(/\s+/u);
    const element = normalizeElement(rawElement);
    const x = Number(rawX);
    const y = Number(rawY);
    const z = Number(rawZ);
    const atomicNumber = element ? ATOMIC_NUMBERS[element] : undefined;

    if (!element || !atomicNumber) {
      issues.push({
        severity: 'error',
        title: 'Unknown element',
        detail: `Atom ${index + 1} uses "${rawElement || 'blank'}", which ChemVault cannot map to an atomic number.`,
        action: 'Correct the element symbol before running the engine.'
      });
    }

    if (![x, y, z].every(Number.isFinite)) {
      issues.push({
        severity: 'error',
        title: 'Invalid coordinates',
        detail: `Atom ${index + 1} has non-numeric XYZ coordinates.`,
        action: 'Regenerate or upload a valid 3D structure.'
      });
    }

    return {
      atomicNumber: atomicNumber || 0,
      element: element || rawElement || 'X',
      index: index + 1,
      x: Number.isFinite(x) ? x : 0,
      y: Number.isFinite(y) ? y : 0,
      z: Number.isFinite(z) ? z : 0
    };
  }).filter((atom) => atom.atomicNumber > 0);
}

function findNearDuplicateAtoms(atoms: QuantumWorkflowAtom[]) {
  const threshold = 0.12;
  for (let first = 0; first < atoms.length; first += 1) {
    for (let second = first + 1; second < atoms.length; second += 1) {
      const dx = atoms[first].x - atoms[second].x;
      const dy = atoms[first].y - atoms[second].y;
      const dz = atoms[first].z - atoms[second].z;
      if (Math.hypot(dx, dy, dz) < threshold) return [atoms[first].index, atoms[second].index] as const;
    }
  }
  return null;
}

function estimateFragmentCount(atoms: QuantumWorkflowAtom[]) {
  if (atoms.length === 0 || atoms.length > 450) return 1;
  const adjacency = atoms.map(() => [] as number[]);
  for (let first = 0; first < atoms.length; first += 1) {
    for (let second = first + 1; second < atoms.length; second += 1) {
      const firstRadius = COVALENT_RADIUS[atoms[first].element] ?? 0.77;
      const secondRadius = COVALENT_RADIUS[atoms[second].element] ?? 0.77;
      const cutoff = Math.max(0.45, (firstRadius + secondRadius) * 1.25);
      const distance = Math.hypot(
        atoms[first].x - atoms[second].x,
        atoms[first].y - atoms[second].y,
        atoms[first].z - atoms[second].z
      );
      if (distance <= cutoff) {
        adjacency[first].push(second);
        adjacency[second].push(first);
      }
    }
  }

  const seen = new Set<number>();
  let fragments = 0;
  atoms.forEach((_atom, start) => {
    if (seen.has(start)) return;
    fragments += 1;
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const current = stack.pop() as number;
      adjacency[current].forEach((next) => {
        if (seen.has(next)) return;
        seen.add(next);
        stack.push(next);
      });
    }
  });
  return fragments;
}

function failureDiagnosis(
  title: string,
  summary: string,
  highlights: string[],
  suggestedActions: string[],
  quality: { factors: string[]; score: number }
): QuantumResultDiagnosis {
  return withQuality({
    severity: 'error',
    title,
    summary,
    highlights,
    suggestedActions: uniqueStrings(suggestedActions).slice(0, 5)
  }, quality);
}

function withQuality<T extends QuantumResultDiagnosis>(diagnosis: T, quality: { factors: string[]; score: number }): T {
  return {
    ...diagnosis,
    qualityFactors: quality.factors,
    qualityScore: quality.score
  };
}

function assessResultQuality(result: QuantumCalculationResult, preflight?: QuantumPreflightResult) {
  let score = result.ok ? 80 : 35;
  const factors: string[] = [];

  if (result.cancelled) {
    score = 20;
    factors.push('Calculation was cancelled before normal completion.');
  }

  if (preflight) {
    score -= preflight.issueCount.errors * 25;
    score -= preflight.issueCount.warnings * 8;
    score -= Math.min(10, preflight.issueCount.info * 2);
    if (preflight.issueCount.errors === 0 && preflight.issueCount.warnings === 0) {
      factors.push('Preflight checks did not find blocking structure, charge, or spin problems.');
    } else {
      factors.push(`Preflight found ${preflight.issueCount.errors} blocking issue(s) and ${preflight.issueCount.warnings} warning(s).`);
    }
  }

  if (result.energyHartree === null) {
    score -= 15;
    factors.push('Total energy was not parsed.');
  } else {
    score += 5;
    factors.push('Total energy was parsed.');
  }

  if (!result.dipoleDebye) {
    score -= 5;
    factors.push('Dipole vector was not parsed.');
  }

  if (result.charges.length === 0) {
    score -= 8;
    factors.push('Partial charges were not parsed.');
  }

  if (result.frequencySummary) {
    if (result.frequencySummary.imaginaryCount === 0) {
      factors.push('Frequency analysis found no imaginary modes.');
    } else {
      score -= Math.min(18, result.frequencySummary.imaginaryCount * 6);
      factors.push(`Frequency analysis found ${result.frequencySummary.imaginaryCount} imaginary mode(s).`);
    }
  }

  if (result.warnings.length > 0) {
    score -= Math.min(20, result.warnings.length * 4);
    factors.push(`${result.warnings.length} engine warning(s) were returned.`);
  }

  return {
    factors: uniqueStrings(factors).slice(0, 6),
    score: Math.max(0, Math.min(100, Math.round(score)))
  };
}

function extractLogHighlights(text: string) {
  const lines = String(text || '')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  const markers = [
    /normal termination/iu,
    /error termination/iu,
    /scf done/iu,
    /convergence failure/iu,
    /charge and multiplicity/iu,
    /distance matrix/iu,
    /atoms too close/iu,
    /basis set/iu,
    /license/iu,
    /l\d+\.exe|link 0/iu,
    /erroneous write/iu
  ];
  return uniqueStrings(lines.filter((line) => markers.some((marker) => marker.test(line))).slice(-6));
}

function normalizeElement(value: string | undefined) {
  const cleaned = String(value || '').replace(/[^a-z]/giu, '');
  if (!cleaned) return '';
  return `${cleaned[0].toUpperCase()}${cleaned.slice(1).toLowerCase()}`;
}

function finiteInteger(value: number, fallback: number) {
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
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

function isQuantumHistoryEntry(value: unknown): value is QuantumHistoryEntry {
  const entry = value as QuantumHistoryEntry;
  return Boolean(entry && typeof entry.id === 'string' && typeof entry.createdAt === 'string' && typeof entry.engineLabel === 'string');
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
