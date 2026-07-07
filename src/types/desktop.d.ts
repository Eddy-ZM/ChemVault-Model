export {};

import type {
  CommercialQuantumEngineKind,
  ExternalQuantumEngineConfig,
  LocalEngineInstallResult,
  LocalEngineStatus,
  LocalOpenSourceEngineKind,
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
      getLocalOpenSourceEngines: () => Promise<LocalEngineStatus[]>;
      installLocalOpenSourceEngine: (engine: LocalOpenSourceEngineKind) => Promise<LocalEngineInstallResult>;
      openLocalEngineFolder: () => Promise<{ ok: boolean; path: string; error?: string }>;
      getExternalQuantumConfig: (engine: CommercialQuantumEngineKind) => Promise<ExternalQuantumEngineConfig>;
      saveExternalQuantumConfig: (config: ExternalQuantumEngineConfig) => Promise<ExternalQuantumEngineConfig>;
      selectQuantumEngineExecutable: (engine: CommercialQuantumEngineKind) => Promise<string | null>;
      runQuantumCalculation: (request: QuantumCalculationRequest) => Promise<QuantumCalculationResult>;
    };
  }
}
