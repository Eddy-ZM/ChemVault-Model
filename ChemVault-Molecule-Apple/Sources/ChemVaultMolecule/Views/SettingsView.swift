import SwiftUI

struct SettingsView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        WorkspaceScreen(
            title: "Settings",
            subtitle: "Review service endpoints used by the native Apple app.",
            systemImage: "gearshape"
        ) {
            CVPanel("Services") {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 260), spacing: 12)], spacing: 12) {
                    MetricTile(title: "User API", value: appState.config.userAPIBaseURL.absoluteString)
                    MetricTile(title: "Molecule API", value: appState.config.moleculeAPIBaseURL.absoluteString)
                    MetricTile(title: "Quantum API", value: appState.config.moleculeAPIBaseURL.appending(path: "quantum/calculate").absoluteString)
                    MetricTile(title: "Remote Config", value: appState.config.remoteConfigURL.absoluteString)
                }
            }

            CVPanel("Quantum Scope") {
                VStack(alignment: .leading, spacing: 10) {
                    Label("Apple app displays supported local or cloud quantum results.", systemImage: "atom")
                    Label("Windows ChemVault Model handles local Gaussian, ORCA, PySCF, and engine setup workflows.", systemImage: "desktopcomputer")
                }
                .font(.subheadline)
                .foregroundStyle(.secondary)
            }
        }
        .frame(minWidth: 520, minHeight: 360)
    }
}
