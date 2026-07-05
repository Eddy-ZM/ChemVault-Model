export {};

import type { QuantumCalculationRequest, QuantumCalculationResult, QuantumEngineStatus } from '@/lib/chem/quantumTypes';

declare global {
  interface Window {
    chemVaultDesktop?: {
      appName: string;
      isDesktop: boolean;
      userApiPrefix: string;
      platform: string;
      getQuantumEngineStatus: () => Promise<QuantumEngineStatus>;
      runQuantumCalculation: (request: QuantumCalculationRequest) => Promise<QuantumCalculationResult>;
    };
  }
}
