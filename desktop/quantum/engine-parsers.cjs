function parseXtbEnergy(output) {
  const matches = Array.from(output.matchAll(/TOTAL\s+ENERGY\s+([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)/giu));
  const last = matches.at(-1);
  return last ? Number(last[1]) : null;
}

function parseXtbDipole(output) {
  const lines = output.split(/\r?\n/u);
  let fallback = null;
  for (const line of lines) {
    const match = line.match(/^\s*(full|q\s+only)\s*:?\s+([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)\s+([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)\s+([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)\s+([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)/iu);
    if (!match) continue;
    const dipole = { x: Number(match[2]), y: Number(match[3]), z: Number(match[4]), total: Number(match[5]) };
    if (/full/iu.test(match[1])) return dipole;
    fallback = dipole;
  }
  return fallback;
}

function parsePyscfResult(output) {
  const match = output.match(/CHEMVAULT_PYSCF_RESULT_START\s*([\s\S]*?)\s*CHEMVAULT_PYSCF_RESULT_END/u);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    const dipole = parsed.dipoleDebye && typeof parsed.dipoleDebye === 'object'
      ? { x: Number(parsed.dipoleDebye.x), y: Number(parsed.dipoleDebye.y), z: Number(parsed.dipoleDebye.z), total: Number(parsed.dipoleDebye.total) }
      : null;
    return {
      energyHartree: Number.isFinite(Number(parsed.energyHartree)) ? Number(parsed.energyHartree) : null,
      dipoleDebye: dipole && Object.values(dipole).every(Number.isFinite) ? dipole : null,
      charges: Array.isArray(parsed.charges)
        ? parsed.charges
            .map((atom) => ({ index: Number(atom.index), element: String(atom.element || '?'), charge: Number(atom.charge) }))
            .filter((atom) => Number.isFinite(atom.index) && Number.isFinite(atom.charge))
        : [],
      method: typeof parsed.method === 'string' ? parsed.method : '',
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map((warning) => String(warning)).filter(Boolean) : []
    };
  } catch {
    return null;
  }
}

function parseOrcaEnergy(output) {
  const matches = Array.from(output.matchAll(/FINAL\s+SINGLE\s+POINT\s+ENERGY\s+([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)/giu));
  const last = matches.at(-1);
  return last ? Number(last[1]) : null;
}

function parseOrcaDipole(output) {
  const vectorMatches = Array.from(output.matchAll(/Total\s+Dipole\s+Moment\s*:?\s+([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)\s+([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)\s+([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)/giu));
  const magnitudeMatches = Array.from(output.matchAll(/Magnitude\s+\(Debye\)\s*:?\s+([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)/giu));
  const vector = vectorMatches.at(-1);
  const magnitude = magnitudeMatches.at(-1);
  if (vector) {
    const scale = 2.541746;
    const x = Number(vector[1]) * scale;
    const y = Number(vector[2]) * scale;
    const z = Number(vector[3]) * scale;
    return { x, y, z, total: magnitude ? Number(magnitude[1]) : Math.hypot(x, y, z) };
  }
  return magnitude ? { x: 0, y: 0, z: 0, total: Number(magnitude[1]) } : null;
}

function parseOrcaCharges(output) {
  const section = output.match(/MULLIKEN\s+ATOMIC\s+CHARGES[\s\S]*?(?:Sum\s+of\s+atomic\s+charges|LOEWDIN|HIRSHFELD|DIPOLE|ORBITAL)/iu)?.[0] || '';
  const charges = [];
  for (const match of section.matchAll(/^\s*(\d+)\s+([A-Za-z]{1,2})\s*:?\s+([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)/gmu)) {
    charges.push({ index: Number(match[1]) + 1, element: match[2], charge: Number(match[3]) });
  }
  return charges;
}

module.exports = {
  parseOrcaCharges,
  parseOrcaDipole,
  parseOrcaEnergy,
  parsePyscfResult,
  parseXtbDipole,
  parseXtbEnergy
};
