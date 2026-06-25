import SwiftUI

struct AccountView: View {
    @Environment(AppState.self) private var appState
    @State private var isRefreshing = false

    var body: some View {
        List {
            Section("Status") {
                DetailRow(title: "Login", value: appState.session == nil ? "Free mode" : "Signed in")
                DetailRow(title: "User", value: appState.session?.user.displayName)
                DetailRow(title: "Membership", value: appState.permissions.membershipTier.rawValue)
                DetailRow(title: "Permissions", value: appState.permissions.permissions.sorted().joined(separator: ", "))
                if let offline = appState.offlineMessage { InlineErrorView(message: offline) }
            }

            Section("Quota") {
                DetailRow(title: "Searches", value: appState.permissions.quota.searchesRemaining.map(String.init))
                DetailRow(title: "Exports", value: appState.permissions.quota.exportsRemaining.map(String.init))
                DetailRow(title: "Saved Projects", value: appState.permissions.quota.savedProjectsRemaining.map(String.init))
            }

            Section("Actions") {
                Button { Task { await refresh() } } label: { LoadingButtonLabel(title: "Refresh Permissions", isLoading: isRefreshing) }
                Link("Open ChemVault User Portal", destination: appState.config.userAPIBaseURL)
                if appState.session != nil {
                    Button("Logout", role: .destructive) { appState.logout() }
                }
            }

            Section("App") {
                DetailRow(title: "Bundle ID", value: appState.config.bundleID)
                DetailRow(title: "Molecule API", value: appState.config.moleculeAPIBaseURL.absoluteString)
                DetailRow(title: "Version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "Development")
            }
        }
    }

    private func refresh() async {
        isRefreshing = true
        await appState.refreshPermissions()
        isRefreshing = false
    }
}
