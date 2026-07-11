const VALID_TASKS = new Set([
  'frequency',
  'optimization-frequency',
  'td-dft',
  'nmr',
  'solvent-model',
  'transition-state',
  'irc',
  'stability',
  'frontier-orbitals',
  'nbo'
]);

function buildGaussianInput({ atoms, memoryGb, options, processorCount }) {
  const outputKeywords = gaussianOutputKeywords(options.outputDetail, options.routeOptions);
  const routeParts = [
    options.outputDetail === 'orbitals' ? '#p' : '#',
    `${options.method}/${options.basisSet}`,
    gaussianRouteKeywords(options.gaussianTask, options.calculationMode),
    outputKeywords,
    options.reuseCheckpoint ? 'Geom=AllCheck Guess=Read' : '',
    options.routeOptions
  ].filter(Boolean);
  const link0 = [
    `%NProcShared=${processorCount}`,
    `%Mem=${memoryGb}GB`,
    options.reuseCheckpoint ? '%OldChk=chemvault-old.chk' : '',
    '%chk=chemvault.chk'
  ].filter(Boolean);

  if (options.reuseCheckpoint) return [...link0, routeParts.join(' '), '', ''].join('\n');
  return [
    ...link0,
    routeParts.join(' '),
    '',
    'ChemVault Model external Gaussian job',
    '',
    `${options.charge} ${options.multiplicity}`,
    ...atoms.map((atom) => `${atom.element} ${formatCoordinate(atom.x)} ${formatCoordinate(atom.y)} ${formatCoordinate(atom.z)}`),
    '',
    ''
  ].join('\n');
}

function gaussianOutputKeywords(detail, routeOptions) {
  const route = String(routeOptions || '');
  const keywords = [];
  if (!/\bpop\s*=/iu.test(route)) {
    if (detail === 'charges') keywords.push('Pop=Regular');
    if (detail === 'orbitals') keywords.push('Pop=Full');
  }
  if (detail === 'orbitals' && !/\bgfinput\b/iu.test(route)) keywords.push('GFInput');
  if (detail === 'orbitals' && !/\bgfprint\b/iu.test(route)) keywords.push('GFPrint');
  return keywords.join(' ');
}

function normalizeGaussianTask(value, calculationMode = 'single-point') {
  const normalized = String(value || '').trim();
  if (VALID_TASKS.has(normalized)) return normalized;
  return calculationMode === 'geometry-optimization' ? 'geometry-optimization' : 'single-point';
}

function gaussianTaskLabelFor(task) {
  const labels = {
    'geometry-optimization': 'Geometry optimization',
    frequency: 'Frequency analysis',
    'optimization-frequency': 'Optimization + frequency',
    'td-dft': 'TD-DFT excited states',
    nmr: 'NMR shielding',
    'solvent-model': 'Solvent model',
    'transition-state': 'Transition-state search',
    irc: 'IRC pathway',
    stability: 'Wavefunction stability',
    'frontier-orbitals': 'Frontier orbital analysis',
    nbo: 'NBO bridge'
  };
  return labels[task] || 'Single point';
}

function gaussianRouteKeywords(task, calculationMode = 'single-point') {
  const normalized = normalizeGaussianTask(task, calculationMode);
  const routes = {
    'geometry-optimization': 'Opt',
    frequency: 'Freq',
    'optimization-frequency': 'Opt Freq',
    'td-dft': 'TD(NStates=10)',
    nmr: 'NMR=GIAO',
    'solvent-model': 'SP SCRF=(SMD,Solvent=Water)',
    'transition-state': 'Opt=(TS,CalcFC,NoEigenTest) Freq',
    irc: 'IRC=(CalcFC,MaxPoints=20)',
    stability: 'Stable=Opt',
    'frontier-orbitals': 'SP',
    nbo: 'Pop=NBORead'
  };
  return routes[normalized] || 'SP';
}

function formatCoordinate(value) {
  return Number(value).toFixed(10);
}

module.exports = {
  buildGaussianInput,
  gaussianOutputKeywords,
  gaussianRouteKeywords,
  gaussianTaskLabelFor,
  normalizeGaussianTask
};
