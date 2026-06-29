import SwiftUI

struct AccountView: View {
    @Environment(AppState.self) private var appState
    @State private var isRefreshing = false

    var body: some View {
        WorkspaceScreen(
            title: "Account",
            subtitle: "Review sign-in state, permissions, quotas, and ChemVault service connections.",
            systemImage: "person.crop.circle"
        ) {
            CVPanel("Status") {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 220), spacing: 12)], spacing: 12) {
                    MetricTile(title: "Login", value: appState.session == nil ? "Free mode" : "Signed in", systemImage: "person")
                    MetricTile(title: "User", value: appState.session?.user.displayName ?? "N/A", systemImage: "envelope")
                    MetricTile(title: "Membership", value: appState.permissions.membershipTier.rawValue, systemImage: "seal")
                    MetricTile(title: "Permissions", value: permissionSummary, systemImage: "checklist")
                }
                if let offline = appState.offlineMessage { InlineErrorView(message: offline) }
            }

            CVPanel("Quota") {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 180), spacing: 12)], spacing: 12) {
                    MetricTile(title: "Searches", value: appState.permissions.quota.searchesRemaining.map(String.init) ?? "N/A", systemImage: "magnifyingglass")
                    MetricTile(title: "Exports", value: appState.permissions.quota.exportsRemaining.map(String.init) ?? "N/A", systemImage: "square.and.arrow.down")
                    MetricTile(title: "Saved Projects", value: appState.permissions.quota.savedProjectsRemaining.map(String.init) ?? "N/A", systemImage: "tray.full")
                }
            }

            CVPanel("Actions") {
                HStack {
                    Button { Task { await refresh() } } label: {
                        LoadingButtonLabel(title: "Refresh Permissions", isLoading: isRefreshing)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isRefreshing)

                    Link("Open ChemVault User Portal", destination: appState.config.userAPIBaseURL)
                        .buttonStyle(.bordered)

                    Spacer()
                }

                if appState.session != nil {
                    Button("Logout", role: .destructive) { appState.logout() }
                        .buttonStyle(.bordered)
                }
            }

            CVPanel("App") {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 260), spacing: 12)], spacing: 12) {
                    MetricTile(title: "Bundle ID", value: appState.config.bundleID)
                    MetricTile(title: "Molecule API", value: appState.config.moleculeAPIBaseURL.absoluteString)
                    MetricTile(title: "Version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "Development")
                }
            }
        }
    }

    private var permissionSummary: String {
        let sorted = appState.permissions.permissions.sorted()
        return sorted.isEmpty ? "N/A" : sorted.joined(separator: ", ")
    }

    private func refresh() async {
        isRefreshing = true
        await appState.refreshPermissions()
        isRefreshing = false
    }
}
