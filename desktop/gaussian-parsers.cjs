const ATOMIC_SYMBOLS = [
  '',
  'H', 'He',
  'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne',
  'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar',
  'K', 'Ca', 'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn',
  'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr',
  'Rb', 'Sr', 'Y', 'Zr', 'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd',
  'In', 'Sn', 'Sb', 'Te', 'I', 'Xe',
  'Cs', 'Ba', 'La', 'Ce', 'Pr', 'Nd', 'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy',
  'Ho', 'Er', 'Tm', 'Yb', 'Lu',
  'Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg',
  'Tl', 'Pb', 'Bi', 'Po', 'At', 'Rn',
  'Fr', 'Ra', 'Ac', 'Th', 'Pa', 'U', 'Np', 'Pu', 'Am', 'Cm', 'Bk', 'Cf',
  'Es', 'Fm', 'Md', 'No', 'Lr',
  'Rf', 'Db', 'Sg', 'Bh', 'Hs', 'Mt', 'Ds', 'Rg', 'Cn', 'Nh', 'Fl', 'Mc',
  'Lv', 'Ts', 'Og'
];

const HARTREE_TO_EV = 27.211386245988;

const GAUSSIAN_ERROR_PATTERNS = [
  {
    id: 'charge-spin',
    title: 'Charge or spin setting failed',
    patterns: [
      /charge\s+and\s+multiplicity/iu,
      /multiplicity/iu,
      /impossible\s+charge/iu,
      /The\s+combination\s+of\s+multiplicity/iu
    ],
    summary: 'Gaussian rejected the charge, spin, or multiplicity setting.',
    repair: 'Review total charge and unpaired electrons before rerunning.'
  },
  {
    id: 'geometry',
    title: 'Geometry needs cleanup',
    patterns: [
      /Problem\s+with\s+the\s+distance\s+matrix/iu,
      /atoms\s+too\s+close/iu,
      /Small\s+interatomic\s+distances/iu,
      /Linear\s+bend/iu,
      /FormBX had a problem/iu
    ],
    summary: 'Gaussian found an invalid or unstable starting geometry.',
    repair: 'Clean or regenerate the 3D structure, then screen with xTB or run a lower-cost optimization.'
  },
  {
    id: 'scf',
    title: 'SCF convergence failed',
    patterns: [
      /Convergence\s+failure/iu,
      /SCF\s+has\s+not\s+converged/iu,
      /No\s+convergence\s+in\s+SCF/iu,
      /Convergence\s+criterion\s+not\s+met/iu
    ],
    summary: 'The electronic structure iteration did not converge.',
    repair: 'Apply SCF=(XQC,MaxCycle=512), try a smaller basis, or improve the geometry before rerunning.'
  },
  {
    id: 'optimization',
    title: 'Optimization did not converge',
    patterns: [
      /Error\s+termination\s+request\s+processed\s+by\s+link\s+9999/iu,
      /l9999\.exe/iu,
      /Maximum\s+number\s+of\s+optimization\s+cycles/iu,
      /Optimization\s+stopped/iu,
      /Number\s+of\s+steps\s+exceeded/iu
    ],
    summary: 'The optimization stopped before reaching a stationary point.',
    repair: 'Use a better starting geometry, add Opt=CalcFC or Opt=MaxCycles, or run a quick xTB optimization first.'
  },
  {
    id: 'basis',
    title: 'Basis set or element mismatch',
    patterns: [
      /Basis\s+set\s+data/iu,
      /Atomic\s+number\s+out\s+of\s+range/iu,
      /Unknown\s+center/iu,
      /No\s+basis\s+functions/iu,
      /pseudo|ECP/iu
    ],
    summary: 'The selected method or basis set does not cover the current elements.',
    repair: 'Choose a basis family and ECP that support every element in the molecule.'
  },
  {
    id: 'syntax',
    title: 'Gaussian input syntax issue',
    patterns: [
      /QPErr/iu,
      /End\s+of\s+file\s+in\s+ZSymb/iu,
      /Unrecognized\s+route/iu,
      /Unknown\s+keyword/iu,
      /Symbolic\s+Z-matrix/iu
    ],
    summary: 'Gaussian rejected a route keyword, title, charge/multiplicity line, or geometry section.',
    repair: 'Open the GJF preview, simplify route options, and rerun after correcting the input.'
  },
  {
    id: 'checkpoint',
    title: 'Checkpoint file issue',
    patterns: [
      /No\s+data\s+on\s+checkpoint\s+file/iu,
      /checkpoint\s+file/iu,
      /ChkBasis/iu,
      /Read-write\s+file/iu,
      /FileIO/iu
    ],
    summary: 'Gaussian could not read or write the checkpoint data needed for this route.',
    repair: 'Use a fresh checkpoint, confirm scratch permissions, or rerun without Guess=Read/Geom=Checkpoint.'
  },
  {
    id: 'scratch-disk',
    title: 'Scratch or disk write issue',
    patterns: [
      /Erroneous\s+write/iu,
      /No\s+space\s+left/iu,
      /disk\s+full/iu,
      /quota/iu,
      /Permission\s+denied/iu,
      /Access\s+is\s+denied/iu
    ],
    summary: 'Gaussian could not write required scratch, log, or checkpoint files.',
    repair: 'Free disk space, change GAUSS_SCRDIR, and confirm write permission to the scratch folder.'
  },
  {
    id: 'memory',
    title: 'Memory allocation issue',
    patterns: [
      /galloc/iu,
      /malloc/iu,
      /not\s+enough\s+memory/iu,
      /memory\s+allocation/iu,
      /Erroneous\s+write.*NtrErr/iu
    ],
    summary: 'Gaussian likely exceeded available memory or scratch capacity.',
    repair: 'Lower the method/basis cost, reduce the structure size, or adjust Gaussian memory settings.'
  },
  {
    id: 'license-runtime',
    title: 'Gaussian runtime or license issue',
    patterns: [
      /license/iu,
      /licensed/iu,
      /l\d+\.exe/iu,
      /link\s+0/iu,
      /GAUSS_EXEDIR/iu,
      /G16ROOT/iu
    ],
    summary: 'Gaussian could not access its licensed runtime, link executables, or environment.',
    repair: 'Re-select the real Gaussian executable and verify it starts from a normal Command Prompt.'
  },
  {
    id: 'nbo',
    title: 'NBO support is unavailable',
    patterns: [
      /NBO.*not\s+found/iu,
      /NBO.*unavailable/iu,
      /Pop=NBO/iu,
      /Unknown\s+keyword.*NBO/iu
    ],
    summary: 'The requested NBO analysis is not available in this local Gaussian/NBO installation.',
    repair: 'Install/configure licensed NBO support or rerun with a standard population analysis route.'
  }
];

function parseGaussianEnergy(output) {
  const text = String(output || '');
  const scfMatches = Array.from(text.matchAll(/SCF\s+Done:\s+E\([^)]+\)\s+=\s+([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)/giu));
  const scf = scfMatches.at(-1);
  if (scf) return Number(scf[1]);

  const correlatedMatches = Array.from(text.matchAll(/(?:E2|EUMP2|DE\(Corr\)|CCSD\(T\))\s*=\s*([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)/giu));
  const correlated = correlatedMatches.at(-1);
  return correlated ? Number(correlated[1]) : null;
}

function parseGaussianDipole(output) {
  const matches = Array.from(String(output || '').matchAll(/X=\s*([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)\s+Y=\s*([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)\s+Z=\s*([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)\s+Tot=\s*([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)/giu));
  const last = matches.at(-1);
  return last
    ? {
        x: Number(last[1]),
        y: Number(last[2]),
        z: Number(last[3]),
        total: Number(last[4])
      }
    : null;
}

function parseGaussianCharges(output) {
  return parseGaussianPopulation(output).charges;
}

function parseGaussianPopulation(output) {
  const mulliken = parseMullikenCharges(output);
  if (mulliken.length) {
    return {
      charges: mulliken,
      model: 'Gaussian Mulliken population analysis'
    };
  }

  const natural = parseNaturalCharges(output);
  if (natural.length) {
    return {
      charges: natural,
      model: 'Gaussian natural population analysis'
    };
  }

  return {
    charges: [],
    model: 'Gaussian population analysis'
  };
}

function parseGaussianFrontierOrbitals(output) {
  const alphaOcc = [];
  const alphaVirt = [];
  const betaOcc = [];
  const betaVirt = [];
  for (const line of String(output || '').split(/\r?\n/u)) {
    const match = line.match(/^\s*(Alpha|Beta)\s+(occ\.|virt\.)\s+eigenvalues\s+--\s+(.+)$/iu);
    if (!match) continue;
    const target = match[1].toLowerCase() === 'alpha'
      ? match[2].toLowerCase().startsWith('occ') ? alphaOcc : alphaVirt
      : match[2].toLowerCase().startsWith('occ') ? betaOcc : betaVirt;
    target.push(...numbersFromLine(match[3]));
  }

  const alphaHomo = alphaOcc.length ? alphaOcc[alphaOcc.length - 1] * HARTREE_TO_EV : null;
  const alphaLumo = alphaVirt.length ? alphaVirt[0] * HARTREE_TO_EV : null;
  const betaHomo = betaOcc.length ? betaOcc[betaOcc.length - 1] * HARTREE_TO_EV : null;
  const betaLumo = betaVirt.length ? betaVirt[0] * HARTREE_TO_EV : null;
  const gap = alphaHomo !== null && alphaLumo !== null ? alphaLumo - alphaHomo : null;
  if (alphaHomo === null && alphaLumo === null && betaHomo === null && betaLumo === null) return null;
  return {
    alphaHomoEv: alphaHomo,
    alphaLumoEv: alphaLumo,
    betaHomoEv: betaHomo,
    betaLumoEv: betaLumo,
    gapEv: gap
  };
}

function parseGaussianFrequencySummary(output) {
  const frequencies = [];
  const intensities = [];
  for (const line of String(output || '').split(/\r?\n/u)) {
    const frequencyMatch = line.match(/^\s*Frequencies\s+--\s+(.+)$/iu);
    if (frequencyMatch) {
      frequencies.push(...numbersFromLine(frequencyMatch[1]));
      continue;
    }
    const intensityMatch = line.match(/^\s*IR\s+Inten\s+--\s+(.+)$/iu);
    if (intensityMatch) {
      intensities.push(...numbersFromLine(intensityMatch[1]));
    }
  }
  if (!frequencies.length) return null;
  return {
    imaginaryCount: frequencies.filter((value) => value < 0).length,
    lowestFrequencyCm1: Math.min(...frequencies),
    modes: frequencies.slice(0, 48).map((value, index) => ({
      valueCm1: value,
      intensityKmMol: Number.isFinite(intensities[index]) ? intensities[index] : null
    }))
  };
}

function parseGaussianThermochemistry(output) {
  const text = String(output || '');
  const zeroPointCorrectionHartree = numberAfter(text, /Zero-point\s+correction=\s*([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)/iu);
  const thermalCorrectionToEnergyHartree = numberAfter(text, /Thermal\s+correction\s+to\s+Energy=\s*([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)/iu);
  const thermalCorrectionToEnthalpyHartree = numberAfter(text, /Thermal\s+correction\s+to\s+Enthalpy=\s*([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)/iu);
  const thermalCorrectionToGibbsHartree = numberAfter(text, /Thermal\s+correction\s+to\s+Gibbs\s+Free\s+Energy=\s*([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)/iu);
  if (
    zeroPointCorrectionHartree === null &&
    thermalCorrectionToEnergyHartree === null &&
    thermalCorrectionToEnthalpyHartree === null &&
    thermalCorrectionToGibbsHartree === null
  ) {
    return null;
  }
  return {
    zeroPointCorrectionHartree,
    thermalCorrectionToEnergyHartree,
    thermalCorrectionToEnthalpyHartree,
    thermalCorrectionToGibbsHartree
  };
}

function parseGaussianOptimizedXyz(output) {
  const blocks = Array.from(String(output || '').matchAll(/(?:Standard|Input)\s+orientation:\s*\n\s*-+\s*\n[\s\S]*?\n\s*-+\s*\n([\s\S]*?)\n\s*-+/giu));
  const last = blocks.at(-1);
  if (!last) return null;
  const atoms = [];
  for (const line of last[1].split(/\r?\n/u)) {
    const parts = line.trim().split(/\s+/u);
    if (parts.length < 6) continue;
    const atomicNumber = Number(parts[1]);
    const x = Number(parts[3]);
    const y = Number(parts[4]);
    const z = Number(parts[5]);
    const element = atomicSymbol(atomicNumber);
    if (!element || ![x, y, z].every(Number.isFinite)) continue;
    atoms.push(`${element} ${formatCoordinate(x)} ${formatCoordinate(y)} ${formatCoordinate(z)}`);
  }
  if (!atoms.length) return null;
  return [String(atoms.length), 'Optimized geometry parsed by ChemVault Model', ...atoms, ''].join('\n');
}

function parseGaussianExcitedStates(output) {
  const states = [];
  for (const match of String(output || '').matchAll(/Excited\s+State\s+(\d+):\s+([^\r\n]*?)\s+([-+]?\d+(?:\.\d+)?)\s+eV\s+([-+]?\d+(?:\.\d+)?)\s+nm(?:\s+f=([-+]?\d+(?:\.\d+)?))?/giu)) {
    states.push({
      state: Number(match[1]),
      label: String(match[2] || '').trim(),
      energyEv: Number(match[3]),
      wavelengthNm: Number(match[4]),
      oscillatorStrength: match[5] === undefined ? null : Number(match[5])
    });
  }
  return states.length ? states.slice(0, 24) : null;
}

function parseGaussianNmrShielding(output) {
  const values = [];
  for (const match of String(output || '').matchAll(/^\s*(\d+)\s+([A-Za-z]{1,2})\s+Isotropic\s*=\s*([-+]?\d+(?:\.\d+)?)/gimu)) {
    values.push({
      index: Number(match[1]),
      element: match[2],
      isotropicPpm: Number(match[3])
    });
  }
  return values.length ? values.slice(0, 200) : null;
}

function diagnoseGaussianLog(output) {
  const text = String(output || '');
  const matches = GAUSSIAN_ERROR_PATTERNS.filter((item) => item.patterns.some((pattern) => pattern.test(text)));
  if (!matches.length) return null;
  const primary = matches[0];
  return {
    id: primary.id,
    title: primary.title,
    summary: primary.summary,
    repair: primary.repair,
    matches: matches.map((match) => match.id),
    highlights: extractGaussianHighlights(text)
  };
}

function summarizeGaussianLogError(output) {
  const diagnosis = diagnoseGaussianLog(output);
  if (diagnosis) {
    return [diagnosis.summary, diagnosis.repair, ...diagnosis.highlights.slice(-3)].filter(Boolean).join(' ');
  }

  const lines = String(output || '').split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return '';

  const markers = [
    /Error termination/iu,
    /QPErr/iu,
    /Erroneous write/iu,
    /End of file/iu,
    /Syntax error/iu,
    /Illegal/iu,
    /Unknown center/iu,
    /Charge and multiplicity/iu,
    /Basis set data/iu,
    /Convergence failure/iu,
    /Problem with the distance matrix/iu,
    /Atoms too close/iu,
    /No data on checkpoint file/iu
  ];
  const selected = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (!markers.some((marker) => marker.test(lines[index]))) continue;
    const start = Math.max(0, index - 2);
    const end = Math.min(lines.length, index + 3);
    for (const line of lines.slice(start, end)) {
      if (!selected.includes(line)) selected.push(line);
    }
  }

  return selected.slice(-8).join(' ');
}

function parseMullikenCharges(output) {
  const sections = Array.from(String(output || '').matchAll(/Mulliken\s+charges(?:\s+and\s+spin\s+densities)?:[\s\S]*?(?:Sum\s+of\s+Mulliken\s+charges|Dipole moment|Quadrupole moment|Job cpu time|Natural\s+Population)/giu));
  const section = sections.at(-1)?.[0] || '';
  const charges = [];
  for (const match of section.matchAll(/^\s*(\d+)\s+([A-Za-z]{1,2})\s+([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)/gmu)) {
    charges.push({
      index: Number(match[1]),
      element: match[2],
      charge: Number(match[3])
    });
  }
  return charges;
}

function parseNaturalCharges(output) {
  const section = String(output || '').match(/Natural\s+Population\s+Analysis:[\s\S]*?(?:Summary\s+of\s+Natural|Natural\s+Bond\s+Orbitals|Job cpu time|Leave Link)/iu)?.[0] || '';
  const charges = [];
  for (const match of section.matchAll(/^\s*(\d+)\s+([A-Za-z]{1,2})\s+[-+]?\d+(?:\.\d+)?\s+([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)/gmu)) {
    charges.push({
      index: Number(match[1]),
      element: match[2],
      charge: Number(match[3])
    });
  }
  return charges;
}

function extractGaussianHighlights(text) {
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
    /l\d+\.exe|link 0|link\s+9999/iu,
    /erroneous write|FileIO/iu,
    /QPErr|Unknown keyword/iu
  ];
  return uniqueStrings(lines.filter((line) => markers.some((marker) => marker.test(line))).slice(-8));
}

function numbersFromLine(value) {
  return Array.from(String(value || '').matchAll(/[-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?/gu))
    .map((match) => Number(match[0]))
    .filter(Number.isFinite);
}

function numberAfter(text, pattern) {
  const match = String(text || '').match(pattern);
  const value = match ? Number(match[1]) : null;
  return Number.isFinite(value) ? value : null;
}

function atomicSymbol(atomicNumber) {
  return ATOMIC_SYMBOLS[atomicNumber] || '';
}

function formatCoordinate(value) {
  return Number.isFinite(value) ? value.toFixed(8) : '0.00000000';
}

function uniqueStrings(values) {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

module.exports = {
  diagnoseGaussianLog,
  parseGaussianCharges,
  parseGaussianDipole,
  parseGaussianEnergy,
  parseGaussianExcitedStates,
  parseGaussianFrequencySummary,
  parseGaussianFrontierOrbitals,
  parseGaussianNmrShielding,
  parseGaussianOptimizedXyz,
  parseGaussianPopulation,
  parseGaussianThermochemistry,
  summarizeGaussianLogError
};
