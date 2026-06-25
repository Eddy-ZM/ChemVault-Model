import Foundation
import Observation

@MainActor
@Observable
final class AppState {
    var config: AppConfig
    var moleculeClient: MoleculeAPIClient
    var authService: AuthService
    var permissionsService: PermissionsService
    var libraryStore: LibraryStore

    var session: UserSession?
    var permissions: MoleculePermissions = .free
    var isBootstrapping = true
    var hasEnteredApp = false
    var offlineMessage: String?

    init(config: AppConfig = .production) {
        self.config = config
        self.moleculeClient = MoleculeAPIClient(baseURL: config.moleculeAPIBaseURL)
        self.authService = AuthService(config: config)
        self.permissionsService = PermissionsService(config: config)
        self.libraryStore = LibraryStore()
    }

    func bootstrap() async {
        session = authService.restoreSession()
        hasEnteredApp = session != nil
        await refreshPermissions()
        libraryStore.load()
        isBootstrapping = false
    }

    func refreshPermissions() async {
        do {
            permissions = try await permissionsService.fetchPermissions(accessToken: session?.accessToken)
            offlineMessage = nil
        } catch {
            permissions = .free
            offlineMessage = "Permissions service is unavailable. Running in Free limited mode."
        }
    }

    func continueInFreeMode() {
        hasEnteredApp = true
        permissions = .free
    }

    func login(email: String, password: String) async throws {
        let nextSession = try await authService.login(email: email, password: password)
        session = nextSession
        hasEnteredApp = true
        await refreshPermissions()
    }

    func logout() {
        authService.logout()
        session = nil
        permissions = .free
        hasEnteredApp = false
    }

    func saveToLibrary(_ summary: MoleculeSummary) {
        libraryStore.save(summary)
    }
}
