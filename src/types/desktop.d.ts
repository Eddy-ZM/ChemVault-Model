export {};

import type {
  CommercialQuantumEngineKind,
  EngineSetupRequest,
  ExternalQuantumEngineConfig,
  GaussianBridgeRequest,
  GaussianBridgeResult,
  GaussianBridgeTools,
  GaussianOpenResult,
  LocalEngineInstallProgress,
  LocalEngineInstallResult,
  LocalEngineSelectResult,
  LocalEngineStatus,
  LocalOpenSourceEngineKind,
  QuantumCalculationProgress,
  QuantumCalculationRequest,
  QuantumCalculationResult,
  QuantumCancelResult,
  QuantumEngineKind,
  QuantumEngineStatus,
  QuantumQueueItem
} from '@/lib/chem/quantumTypes';

declare global {
  type DesktopVersionStatus = {
    ok: boolean;
    appName: string;
    platform: 'windows';
    status: 'current' | 'available' | 'required' | 'offline';
    currentVersion: string;
    currentBuildId: string;
    currentReleaseId: string;
    currentBuildNumber: number;
    latestVersion: string;
    latestBuildId: string;
    latestReleaseId: string;
    latestBuildNumber: number;
    minimumSupportedVersion: string;
    updateAvailable: boolean;
    updateRequired: boolean;
    canDefer: boolean;
    deferralHours: number;
    checkIntervalSeconds: number;
    checkedAt: string;
    sourceUrl: string;
    downloadUrl: string;
    releaseNotesUrl: string;
    message: string;
    error?: string;
  };

  interface Window {
    chemVaultDesktop?: {
      appName: string;
      isDesktop: boolean;
      userApiPrefix: string;
      platform: string;
      getVersionStatus: () => Promise<DesktopVersionStatus>;
      openUpdateUrl: (url?: string) => Promise<{ ok: boolean; url: string }>;
      getQuantumEngineStatus: (engine?: QuantumEngineKind) => Promise<QuantumEngineStatus>;
      getEngineSetupRequest: () => Promise<EngineSetupRequest>;
      clearEngineSetupRequest: () => Promise<{ ok: boolean }>;
      getLocalOpenSourceEngines: () => Promise<LocalEngineStatus[]>;
      installLocalOpenSourceEngine: (engine: LocalOpenSourceEngineKind) => Promise<LocalEngineInstallResult>;
      selectLocalOpenSourceEngineExecutable: (engine: LocalOpenSourceEngineKind) => Promise<LocalEngineSelectResult>;
      onLocalEngineInstallProgress: (handler: (progress: LocalEngineInstallProgress) => void) => () => void;
      openLocalEngineFolder: () => Promise<{ ok: boolean; path: string; error?: string }>;
      getExternalQuantumConfig: (engine: CommercialQuantumEngineKind) => Promise<ExternalQuantumEngineConfig>;
      discoverExternalQuantumConfig: (engine: CommercialQuantumEngineKind) => Promise<{
        config: ExternalQuantumEngineConfig;
        found: boolean;
        message: string;
      }>;
      saveExternalQuantumConfig: (config: ExternalQuantumEngineConfig) => Promise<ExternalQuantumEngineConfig>;
      selectQuantumEngineExecutable: (engine: CommercialQuantumEngineKind) => Promise<string | null>;
      selectGaussianScratchDirectory: () => Promise<string | null>;
      getGaussianBridgeTools: () => Promise<GaussianBridgeTools>;
      runGaussianFormchk: (request: GaussianBridgeRequest) => Promise<GaussianBridgeResult>;
      runGaussianCubegen: (request: GaussianBridgeRequest) => Promise<GaussianBridgeResult>;
      openGaussianInGaussView: (request: GaussianBridgeRequest) => Promise<GaussianOpenResult>;
      onQuantumCalculationProgress: (handler: (progress: QuantumCalculationProgress) => void) => () => void;
      runQuantumCalculation: (request: QuantumCalculationRequest) => Promise<QuantumCalculationResult>;
      cancelQuantumCalculation: (calculationId: string) => Promise<QuantumCancelResult>;
      getQuantumQueue: () => Promise<QuantumQueueItem[]>;
      saveQuantumQueue: (items: QuantumQueueItem[]) => Promise<QuantumQueueItem[]>;
      getQuantumProjects: () => Promise<import('@/lib/chem/quantumProjectWorkspace').QuantumProjectRecord[]>;
      saveQuantumProjects: (projects: import('@/lib/chem/quantumProjectWorkspace').QuantumProjectRecord[]) => Promise<import('@/lib/chem/quantumProjectWorkspace').QuantumProjectRecord[]>;
    };
  }
}
