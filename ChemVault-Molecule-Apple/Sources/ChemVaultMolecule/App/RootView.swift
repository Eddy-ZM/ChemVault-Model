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
            } else if appState.requiresImmediateVersionUpdate {
                VersionUpdateGateView(required: true)
            } else if appState.shouldShowVersionUpdatePrompt {
                VersionUpdateGateView(required: false)
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

private struct VersionUpdateGateView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.openURL) private var openURL
    @State private var isChecking = false

    let required: Bool

    var body: some View {
        VStack(spacing: 18) {
            Image(systemName: "arrow.down.app")
                .font(.system(size: 44, weight: .semibold))
                .foregroundStyle(AppTheme.brand)
            Text(required ? "Update required" : "Update available")
                .font(.title2.weight(.bold))
            Text(message)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 480)
            HStack(spacing: 12) {
                if appState.canTemporarilyContinueWithoutLatestVersion {
                    Button("Continue briefly") {
                        appState.deferVersionUpdateTemporarily()
                    }
                    .buttonStyle(.bordered)
                }
                Button(isChecking ? "Checking" : "Check again") {
                    Task {
                        isChecking = true
                        await appState.refreshRemoteConfig()
                        isChecking = false
                    }
                }
                .buttonStyle(.bordered)
                .disabled(isChecking)
                Button("Update now") {
                    if let updateURL = appState.remoteConfig.updateDownloadURL {
                        openURL(updateURL)
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(appState.remoteConfig.updateDownloadURL == nil)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AppTheme.workspaceBackground)
    }

    private var message: String {
        if !appState.remoteConfig.updateMessage.isEmpty {
            return appState.remoteConfig.updateMessage
        }

        return required
            ? "This app build is below the supported release line. Update before continuing."
            : "A newer ChemVault Molecule release is available. You can continue briefly and update soon."
    }
}
