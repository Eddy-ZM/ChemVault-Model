import SwiftUI

@main
struct ChemVaultMoleculeApp: App {
    @State private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
                .task { await appState.bootstrap() }
        }
#if os(macOS)
        Settings {
            SettingsView()
                .environment(appState)
        }
#endif
    }
}
