export {};

declare global {
  interface Window {
    chemVaultDesktop?: {
      appName: string;
      isDesktop: boolean;
      userApiPrefix: string;
      platform: string;
    };
  }
}
