import SwiftUI

struct RootView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        Group {
            if appState.isBootstrapping {
                LaunchStatusView()
            } else if appState.remoteConfig.maintenanceMode {
                RemoteConfigGateView(
                    title: "ChemVault Molecule is in maintenance",
                    message: appState.remoteConfig.announcementMessage.isEmpty
                        ? "The workspace is temporarily unavailable. Please try again later."
                        : appState.remoteConfig.announcementMessage,
                    systemImage: "wrench.and.screwdriver"
                )
            } else if !appState.remoteConfig.supportsCurrentAppVersion() {
                RemoteConfigGateView(
                    title: "Update ChemVault Molecule",
                    message: "This version is no longer supported. Minimum supported version: \(appState.remoteConfig.minimumSupportedVersion).",
                    systemImage: "arrow.down.app"
                )
            } else if appState.hasEnteredApp {
                MainTabView()
            } else {
                LoginView()
            }
        }
    }
}

private struct LaunchStatusView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "atom")
                .font(.system(size: 42, weight: .semibold))
                .foregroundStyle(AppTheme.brand)
            VStack(spacing: 6) {
                Text("ChemVault Molecule")
                    .font(.title2.weight(.semibold))
                Text("Preparing native workspace")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
            ProgressView()
                .controlSize(.large)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AppTheme.workspaceBackground)
    }
}

private struct RemoteConfigGateView: View {
    let title: String
    let message: String
    let systemImage: String

    var body: some View {
        VStack(spacing: 18) {
            Image(systemName: systemImage)
                .font(.system(size: 44, weight: .semibold))
                .foregroundStyle(AppTheme.brand)
            Text(title)
                .font(.title2.weight(.bold))
            Text(message)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 460)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AppTheme.workspaceBackground)
    }
}
