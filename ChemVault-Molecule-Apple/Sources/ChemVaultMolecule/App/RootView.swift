import SwiftUI

struct RootView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        Group {
            if appState.isBootstrapping {
                ProgressView("Starting ChemVault Molecule")
                    .controlSize(.large)
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

private struct RemoteConfigGateView: View {
    let title: String
    let message: String
    let systemImage: String

    var body: some View {
        VStack(spacing: 18) {
            Image(systemName: systemImage)
                .font(.system(size: 44, weight: .semibold))
                .foregroundStyle(.accent)
            Text(title)
                .font(.title2.weight(.bold))
            Text(message)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 460)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.accentColor.opacity(0.04))
    }
}
