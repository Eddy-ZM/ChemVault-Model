export {};

import type {
  ExternalQuantumEngineConfig,
  QuantumCalculationRequest,
  QuantumCalculationResult,
  QuantumEngineKind,
  QuantumEngineStatus
} from '@/lib/chem/quantumTypes';

declare global {
  interface Window {
    chemVaultDesktop?: {
      appName: string;
      isDesktop: boolean;
      userApiPrefix: string;
      platform: string;
      getQuantumEngineStatus: (engine?: QuantumEngineKind) => Promise<QuantumEngineStatus>;
      getExternalQuantumConfig: (engine: Exclude<QuantumEngineKind, 'xtb'>) => Promise<ExternalQuantumEngineConfig>;
      saveExternalQuantumConfig: (config: ExternalQuantumEngineConfig) => Promise<ExternalQuantumEngineConfig>;
      selectQuantumEngineExecutable: (engine: Exclude<QuantumEngineKind, 'xtb'>) => Promise<string | null>;
      runQuantumCalculation: (request: QuantumCalculationRequest) => Promise<QuantumCalculationResult>;
    };
  }
}
