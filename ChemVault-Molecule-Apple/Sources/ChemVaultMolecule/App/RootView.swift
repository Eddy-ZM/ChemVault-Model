import SwiftUI

struct RootView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        Group {
            if appState.isBootstrapping {
                ProgressView("Starting ChemVault Molecule")
                    .controlSize(.large)
            } else if appState.hasEnteredApp {
                MainTabView()
            } else {
                LoginView()
            }
        }
    }
}
