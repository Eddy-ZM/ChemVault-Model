const WATER_REFERENCES = Object.freeze({
  xtb: { energyHartree: -5.07, toleranceHartree: 1.5, termination: null },
  pyscf: { energyHartree: -76.4, toleranceHartree: 2, termination: null },
  gaussian: { energyHartree: -76.4, toleranceHartree: 2, termination: /Normal termination of Gaussian/iu },
  orca: { energyHartree: -76.4, toleranceHartree: 2, termination: /ORCA TERMINATED NORMALLY/iu }
});

function validateWaterSelfTest(engineValue, result, versionValue = '') {
  const engine = String(engineValue || '').toLowerCase();
  const reference = WATER_REFERENCES[engine] || WATER_REFERENCES.pyscf;
  const output = String(result?.outputLog || result?.outputTail || '');
  const energy = finiteNumber(result?.energyHartree);
  const dipole = dipoleMagnitude(result?.dipoleDebye);
  const charges = Array.isArray(result?.charges) ? result.charges : [];
  const chargeValues = charges.map(chargeValue).filter(Number.isFinite);
  const chargeSum = chargeValues.reduce((sum, value) => sum + value, 0);
  const version = String(result?.engineVersion || versionValue || '').trim();
  const checks = {
    processCompleted: Boolean(result?.ok && !result?.cancelled && !result?.timedOut),
    normalTermination: reference.termination ? reference.termination.test(output) : Boolean(result?.ok),
    energyInReferenceWindow: energy !== null && Math.abs(energy - reference.energyHartree) <= reference.toleranceHartree,
    atomChargesParsed: chargeValues.length === 3,
    totalChargeConserved: chargeValues.length === 3 && Math.abs(chargeSum) <= 0.08,
    dipoleParsed: dipole !== null && dipole >= 0 && dipole <= 5,
    versionDetected: version.length > 0
  };
  const failedChecks = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);

  return {
    passed: failedChecks.length === 0,
    checks,
    failedChecks,
    reference: {
      molecule: 'water',
      atomCount: 3,
      totalCharge: 0,
      energyHartree: reference.energyHartree,
      toleranceHartree: reference.toleranceHartree
    },
    observed: {
      energyHartree: energy,
      dipoleDebye: dipole,
      atomChargeCount: chargeValues.length,
      totalCharge: chargeValues.length ? chargeSum : null,
      version
    }
  };
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function chargeValue(item) {
  if (typeof item === 'number') return item;
  return Number(item?.charge ?? item?.value ?? item?.partialCharge);
}

function dipoleMagnitude(value) {
  const direct = finiteNumber(value);
  if (direct !== null) return direct;
  if (!value || typeof value !== 'object') return null;
  const explicit = finiteNumber(value.magnitude ?? value.total);
  if (explicit !== null) return explicit;
  const x = finiteNumber(value.x);
  const y = finiteNumber(value.y);
  const z = finiteNumber(value.z);
  return x !== null && y !== null && z !== null ? Math.sqrt(x * x + y * y + z * z) : null;
}

module.exports = { WATER_REFERENCES, validateWaterSelfTest };
