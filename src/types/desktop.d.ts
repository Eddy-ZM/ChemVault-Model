export {};

import type {
  CommercialQuantumEngineKind,
  EngineSetupRequest,
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
      getEngineSetupRequest: () => Promise<EngineSetupRequest>;
      clearEngineSetupRequest: () => Promise<{ ok: boolean }>;
      getLocalOpenSourceEngines: () => Promise<LocalEngineStatus[]>;
      installLocalOpenSourceEngine: (engine: LocalOpenSourceEngineKind) => Promise<LocalEngineInstallResult>;
      openLocalEngineFolder: () => Promise<{ ok: boolean; path: string; error?: string }>;
      getExternalQuantumConfig: (engine: CommercialQuantumEngineKind) => Promise<ExternalQuantumEngineConfig>;
      discoverExternalQuantumConfig: (engine: CommercialQuantumEngineKind) => Promise<{
        config: ExternalQuantumEngineConfig;
        found: boolean;
        message: string;
      }>;
      saveExternalQuantumConfig: (config: ExternalQuantumEngineConfig) => Promise<ExternalQuantumEngineConfig>;
      selectQuantumEngineExecutable: (engine: CommercialQuantumEngineKind) => Promise<string | null>;
      runQuantumCalculation: (request: QuantumCalculationRequest) => Promise<QuantumCalculationResult>;
    };
  }
}
