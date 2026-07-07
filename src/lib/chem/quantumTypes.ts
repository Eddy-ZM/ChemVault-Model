export type QuantumEngineStatus = {
  available: boolean;
  engine: 'xTB';
  method: 'GFN2-xTB';
  executable?: string;
  source?: 'bundled' | 'environment' | 'path';
  version?: string;
  message?: string;
};

export type QuantumCalculationRequest = {
  xyz: string;
  charge: number;
  unpairedElectrons: number;
  method: 'gfn2';
  calculationMode?: 'single-point' | 'geometry-optimization';
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
  calculationMode: 'single-point' | 'geometry-optimization';
  energyHartree: number | null;
  dipoleDebye: {
    x: number;
    y: number;
    z: number;
    total: number;
  } | null;
  charges: QuantumAtomCharge[];
  chargeModel: 'xTB population analysis';
  elapsedMs: number;
  warnings: string[];
  outputTail: string;
  error?: string;
};
