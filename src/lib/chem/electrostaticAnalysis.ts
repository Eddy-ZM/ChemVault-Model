export type StructureFormat = 'sdf' | 'mol' | 'xyz' | 'pdb' | 'cif' | string;

type ParsedAtom = {
  index: number;
  element: string;
  x: number;
  y: number;
  z: number;
};

type ParsedBond = {
  from: number;
  to: number;
  order: number;
};

export type AtomCharge = ParsedAtom & {
  charge: number;
};

export type ElectrostaticAnalysis = {
  method: string;
  atoms: AtomCharge[];
  bonds: ParsedBond[];
  centroid: Vector3;
  dipole: {
    vector: Vector3;
    magnitudeDebye: number;
  };
  chargeSeparation: {
    positiveCenter: Vector3 | null;
    negativeCenter: Vector3 | null;
    distance: number | null;
  };
  netCharge: number;
  warnings: string[];
};

type Vector3 = {
  x: number;
  y: number;
  z: number;
};

const DEBYE_PER_E_ANGSTROM = 4.80320471257;

const ELECTRONEGATIVITY: Record<string, number> = {
  H: 2.2,
  Li: 0.98,
  Be: 1.57,
  B: 2.04,
  C: 2.55,
  N: 3.04,
  O: 3.44,
  F: 3.98,
  Na: 0.93,
  Mg: 1.31,
  Al: 1.61,
  Si: 1.9,
  P: 2.19,
  S: 2.58,
  Cl: 3.16,
  K: 0.82,
  Ca: 1,
  Fe: 1.83,
  Cu: 1.9,
  Zn: 1.65,
  Br: 2.96,
  I: 2.66
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

export function analyzeElectrostatics(structureData: string | null | undefined, format: StructureFormat | null | undefined): ElectrostaticAnalysis | null {
  if (!structureData?.trim()) return null;

  const normalizedFormat = String(format || '').toLowerCase();
  const parsed = parseStructure(structureData, normalizedFormat);
  if (!parsed || parsed.atoms.length === 0) return null;

  const warnings: string[] = [];
  let bonds = parsed.bonds;
  if (bonds.length === 0) {
    if (parsed.atoms.length > 300) {
      warnings.push('Bond inference skipped for large structures.');
    } else {
      bonds = inferBonds(parsed.atoms);
      if (bonds.length > 0) warnings.push('Bonds were inferred from covalent radii.');
    }
  }

  const charges = estimatePartialCharges(parsed.atoms, bonds);
  const atoms = parsed.atoms.map((atom, index) => ({ ...atom, charge: charges[index] ?? 0 }));
  const centroid = averagePosition(parsed.atoms);
  const dipoleVector = atoms.reduce(
    (vector, atom) => ({
      x: vector.x + atom.charge * (atom.x - centroid.x),
      y: vector.y + atom.charge * (atom.y - centroid.y),
      z: vector.z + atom.charge * (atom.z - centroid.z)
    }),
    { x: 0, y: 0, z: 0 }
  );
  const dipoleDebye = scaleVector(dipoleVector, DEBYE_PER_E_ANGSTROM);
  const centers = chargeCenters(atoms);

  warnings.push('Fast website estimate only. Not a substitute for ab initio, DFT, xTB, or force-field charge assignment.');

  return {
    method: 'Fast electronegativity estimate',
    atoms,
    bonds,
    centroid,
    dipole: {
      vector: dipoleDebye,
      magnitudeDebye: magnitude(dipoleDebye)
    },
    chargeSeparation: centers,
    netCharge: atoms.reduce((sum, atom) => sum + atom.charge, 0),
    warnings
  };
}

function parseStructure(data: string, format: string) {
  if (format === 'xyz') return parseXyz(data);
  if (format === 'pdb' || format === 'cif') return parsePdb(data);
  return parseMolLike(data);
}

function parseMolLike(data: string): { atoms: ParsedAtom[]; bonds: ParsedBond[] } | null {
  const lines = data.replace(/\r/g, '').split('\n');
  const countsLineIndex = lines.findIndex((line) => /V[23]000/i.test(line) || /^\s*\d+\s+\d+/.test(line));
  if (countsLineIndex < 0) return parseXyz(data);

  const counts = lines[countsLineIndex];
  const atomCount = Number.parseInt(counts.slice(0, 3).trim() || counts.trim().split(/\s+/)[0], 10);
  const bondCount = Number.parseInt(counts.slice(3, 6).trim() || counts.trim().split(/\s+/)[1], 10);
  if (!Number.isFinite(atomCount) || atomCount <= 0) return null;

  const atomStart = countsLineIndex + 1;
  const atoms = lines.slice(atomStart, atomStart + atomCount).map((line, offset) => {
    const parts = line.trim().split(/\s+/);
    const x = toFiniteNumber(line.slice(0, 10)) ?? toFiniteNumber(parts[0]);
    const y = toFiniteNumber(line.slice(10, 20)) ?? toFiniteNumber(parts[1]);
    const z = toFiniteNumber(line.slice(20, 30)) ?? toFiniteNumber(parts[2]);
    const element = normalizeElement(line.slice(31, 34).trim() || parts[3]);
    if (x === null || y === null || z === null || !element) return null;
    return { index: offset + 1, element, x, y, z };
  }).filter(Boolean) as ParsedAtom[];

  const bondStart = atomStart + atomCount;
  const bonds = lines.slice(bondStart, bondStart + Math.max(0, bondCount)).map((line) => {
    const parts = line.trim().split(/\s+/);
    const from = Number.parseInt(line.slice(0, 3).trim() || parts[0], 10);
    const to = Number.parseInt(line.slice(3, 6).trim() || parts[1], 10);
    const order = Number.parseInt(line.slice(6, 9).trim() || parts[2], 10);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from <= 0 || to <= 0) return null;
    return { from: from - 1, to: to - 1, order: normalizeBondOrder(order) };
  }).filter(Boolean) as ParsedBond[];

  return { atoms, bonds };
}

function parseXyz(data: string): { atoms: ParsedAtom[]; bonds: ParsedBond[] } | null {
  const lines = data.replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return null;

  const declaredCount = Number.parseInt(lines[0], 10);
  const atomLines = Number.isFinite(declaredCount) ? lines.slice(2, 2 + declaredCount) : lines;
  const atoms = atomLines.map((line, offset) => {
    const [rawElement, rawX, rawY, rawZ] = line.split(/\s+/);
    const element = normalizeElement(rawElement);
    const x = toFiniteNumber(rawX);
    const y = toFiniteNumber(rawY);
    const z = toFiniteNumber(rawZ);
    if (!element || x === null || y === null || z === null) return null;
    return { index: offset + 1, element, x, y, z };
  }).filter(Boolean) as ParsedAtom[];

  return atoms.length ? { atoms, bonds: [] } : null;
}

function parsePdb(data: string): { atoms: ParsedAtom[]; bonds: ParsedBond[] } | null {
  const lines = data.replace(/\r/g, '').split('\n');
  const serialToIndex = new Map<number, number>();
  const atoms: ParsedAtom[] = [];

  lines.forEach((line) => {
    if (!line.startsWith('ATOM') && !line.startsWith('HETATM')) return;
    const serial = Number.parseInt(line.slice(6, 11).trim(), 10);
    const element = inferPdbElement(line.slice(76, 78), line.slice(12, 16));
    const x = toFiniteNumber(line.slice(30, 38));
    const y = toFiniteNumber(line.slice(38, 46));
    const z = toFiniteNumber(line.slice(46, 54));
    if (!element || x === null || y === null || z === null) return;
    serialToIndex.set(serial, atoms.length);
    atoms.push({ index: atoms.length + 1, element, x, y, z });
  });

  const seen = new Set<string>();
  const bonds: ParsedBond[] = [];
  lines.forEach((line) => {
    if (!line.startsWith('CONECT')) return;
    const values = line.slice(6).trim().split(/\s+/).map((value) => Number.parseInt(value, 10)).filter(Number.isFinite);
    const fromSerial = values[0];
    const from = serialToIndex.get(fromSerial);
    if (from === undefined) return;
    values.slice(1).forEach((toSerial) => {
      const to = serialToIndex.get(toSerial);
      if (to === undefined || to === from) return;
      const key = [from, to].sort((a, b) => a - b).join('-');
      if (seen.has(key)) return;
      seen.add(key);
      bonds.push({ from, to, order: 1 });
    });
  });

  return atoms.length ? { atoms, bonds } : null;
}

function inferBonds(atoms: ParsedAtom[]): ParsedBond[] {
  const bonds: ParsedBond[] = [];
  for (let i = 0; i < atoms.length; i += 1) {
    for (let j = i + 1; j < atoms.length; j += 1) {
      const first = atoms[i];
      const second = atoms[j];
      const radiusSum = (COVALENT_RADIUS[first.element] ?? 0.77) + (COVALENT_RADIUS[second.element] ?? 0.77);
      const distance = distanceBetween(first, second);
      if (distance > 0.35 && distance <= radiusSum * 1.25) {
        bonds.push({ from: i, to: j, order: 1 });
      }
    }
  }
  return bonds;
}

function estimatePartialCharges(atoms: ParsedAtom[], bonds: ParsedBond[]) {
  const charges = new Array(atoms.length).fill(0) as number[];
  bonds.forEach((bond) => {
    const from = atoms[bond.from];
    const to = atoms[bond.to];
    if (!from || !to) return;
    const fromChi = ELECTRONEGATIVITY[from.element] ?? 2.2;
    const toChi = ELECTRONEGATIVITY[to.element] ?? 2.2;
    const orderFactor = Math.min(Math.max(bond.order || 1, 1), 3) ** 0.5;
    const transfer = clamp((toChi - fromChi) * 0.08 * orderFactor, -0.28, 0.28);
    charges[bond.from] += transfer;
    charges[bond.to] -= transfer;
  });

  const net = charges.reduce((sum, charge) => sum + charge, 0);
  const correction = atoms.length ? net / atoms.length : 0;
  return charges.map((charge) => charge - correction);
}

function chargeCenters(atoms: AtomCharge[]) {
  const positive = weightedCenter(atoms.filter((atom) => atom.charge > 0), (atom) => atom.charge);
  const negative = weightedCenter(atoms.filter((atom) => atom.charge < 0), (atom) => Math.abs(atom.charge));
  return {
    positiveCenter: positive,
    negativeCenter: negative,
    distance: positive && negative ? distanceBetween(positive, negative) : null
  };
}

function weightedCenter(atoms: AtomCharge[], weight: (atom: AtomCharge) => number): Vector3 | null {
  const total = atoms.reduce((sum, atom) => sum + weight(atom), 0);
  if (total <= 0) return null;
  return atoms.reduce(
    (center, atom) => ({
      x: center.x + (atom.x * weight(atom)) / total,
      y: center.y + (atom.y * weight(atom)) / total,
      z: center.z + (atom.z * weight(atom)) / total
    }),
    { x: 0, y: 0, z: 0 }
  );
}

function averagePosition(atoms: ParsedAtom[]): Vector3 {
  if (atoms.length === 0) return { x: 0, y: 0, z: 0 };
  return atoms.reduce(
    (center, atom) => ({
      x: center.x + atom.x / atoms.length,
      y: center.y + atom.y / atoms.length,
      z: center.z + atom.z / atoms.length
    }),
    { x: 0, y: 0, z: 0 }
  );
}

function normalizeElement(value?: string) {
  if (!value) return '';
  const match = value.trim().match(/[A-Za-z]{1,2}/);
  if (!match) return '';
  const raw = match[0];
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function inferPdbElement(elementField: string, atomName: string) {
  const explicit = normalizeElement(elementField.trim());
  if (explicit) return explicit;

  const compactName = atomName.replace(/[0-9]/g, '').trim().toUpperCase();
  const commonTwoLetter = ['CL', 'BR', 'NA', 'MG', 'ZN', 'FE', 'MN', 'CU', 'CO', 'NI'];
  const twoLetter = compactName.slice(0, 2);
  if (commonTwoLetter.includes(twoLetter)) return normalizeElement(twoLetter);
  return normalizeElement(compactName.charAt(0));
}

function normalizeBondOrder(order: number) {
  if (order === 2 || order === 3) return order;
  return 1;
}

function toFiniteNumber(value?: string) {
  if (value === undefined) return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function scaleVector(vector: Vector3, scale: number) {
  return {
    x: vector.x * scale,
    y: vector.y * scale,
    z: vector.z * scale
  };
}

function magnitude(vector: Vector3) {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function distanceBetween(first: Vector3, second: Vector3) {
  return Math.hypot(first.x - second.x, first.y - second.y, first.z - second.z);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
