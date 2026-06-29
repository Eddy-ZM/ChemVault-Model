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
                    MetricTile(title: "Remote Config", value: appState.config.remoteConfigURL.absoluteString)
                }
            }
        }
        .frame(minWidth: 520, minHeight: 360)
    }
}
