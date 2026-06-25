import SwiftUI

struct SettingsView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        Form {
            Section("API") {
                DetailRow(title: "User API", value: appState.config.userAPIBaseURL.absoluteString)
                DetailRow(title: "Molecule API", value: appState.config.moleculeAPIBaseURL.absoluteString)
            }
        }
        .padding()
        .frame(minWidth: 420)
    }
}
