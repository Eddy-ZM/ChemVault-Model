export type QuantumEngineStatus = {
  available: boolean;
  engine: 'xTB';
  method: 'GFN2-xTB';
  executable?: string;
  version?: string;
  message?: string;
};

export type QuantumCalculationRequest = {
  xyz: string;
  charge: number;
  unpairedElectrons: number;
  method: 'gfn2';
  timeoutMs?: number;
};

export type QuantumAtomCharge = {
  index: number;
  element: string;
  charge: number;
};

export type QuantumCalculationResult = {
  ok: boolean;
  engine: 'xTB';
  method: 'GFN2-xTB';
  energyHartree: number | null;
  dipoleDebye: {
    x: number;
    y: number;
    z: number;
    total: number;
  } | null;
  charges: QuantumAtomCharge[];
  elapsedMs: number;
  warnings: string[];
  outputTail: string;
  error?: string;
};
