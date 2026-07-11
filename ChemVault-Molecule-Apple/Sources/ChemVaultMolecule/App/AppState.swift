import Foundation
import Observation

@MainActor
@Observable
final class AppState {
    private let updateDeferralUntilKey = "chemvault.molecule.update.deferUntil"
    private let updateDeferralPairKey = "chemvault.molecule.update.deferPair"

    var config: AppConfig
    var moleculeClient: MoleculeAPIClient
    var quantumService: QuantumCalculationService
    var authService: AuthService
    var permissionsService: PermissionsService
    var libraryStore: LibraryStore

    var session: UserSession?
    var permissions: MoleculePermissions = .free
    var remoteConfig: RemoteAppConfig = .fallback
    var remoteConfigError: String?
    var isBootstrapping = true
    var hasEnteredApp = false
    var offlineMessage: String?
    var updateDeferredUntil: Date?
    var updateDeferredPair: String?

    init(config: AppConfig = .production) {
        self.config = config
        self.moleculeClient = MoleculeAPIClient(baseURL: config.moleculeAPIBaseURL)
        self.quantumService = QuantumCalculationService(baseURL: config.moleculeAPIBaseURL)
        self.authService = AuthService(config: config)
        self.permissionsService = PermissionsService(config: config)
        self.libraryStore = LibraryStore()
        self.updateDeferredUntil = UserDefaults.standard.object(forKey: updateDeferralUntilKey) as? Date
        self.updateDeferredPair = UserDefaults.standard.string(forKey: updateDeferralPairKey)
    }

    var requiresImmediateVersionUpdate: Bool {
        !remoteConfig.supportsCurrentAppVersion()
    }

    var hasNewerVersionAvailable: Bool {
        !remoteConfig.isCurrentAppLatestVersion()
    }

    var canTemporarilyContinueWithoutLatestVersion: Bool {
        hasNewerVersionAvailable && !requiresImmediateVersionUpdate
    }

    var shouldShowVersionUpdatePrompt: Bool {
        if requiresImmediateVersionUpdate {
            return true
        }

        if !canTemporarilyContinueWithoutLatestVersion {
            return false
        }

        return !isVersionUpdateDeferred
    }

    private var isVersionUpdateDeferred: Bool {
        guard updateDeferredPair == remoteConfig.updatePairIdentifier,
              let updateDeferredUntil else {
            return false
        }

        return updateDeferredUntil > Date()
    }

    func bootstrap() async {
        await refreshRemoteConfig()
        session = authService.restoreSession()
        quantumService.accessToken = session?.accessToken
        hasEnteredApp = session != nil
        await refreshPermissions()
        libraryStore.load()
        isBootstrapping = false
    }

    func refreshRemoteConfig() async {
        do {
            var request = URLRequest(url: config.remoteConfigURL)
            request.httpMethod = "GET"
            request.setValue("application/json", forHTTPHeaderField: "Accept")

            let (data, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse,
                  (200..<300).contains(httpResponse.statusCode) else {
                throw RemoteConfigError.invalidResponse
            }

            remoteConfig = try JSONDecoder().decode(RemoteAppConfig.self, from: data)
            remoteConfigError = nil
        } catch {
            remoteConfig = .fallback
            remoteConfigError = error.localizedDescription
        }
        clearExpiredVersionUpdateDeferral()
    }

    func runRemoteConfigMonitor() async {
        while !Task.isCancelled {
            let seconds = max(60, remoteConfig.updateCheckIntervalSeconds)
            try? await Task.sleep(nanoseconds: UInt64(seconds) * 1_000_000_000)
            if Task.isCancelled { return }
            await refreshRemoteConfig()
        }
    }

    func deferVersionUpdateTemporarily() {
        guard canTemporarilyContinueWithoutLatestVersion else { return }
        let hours = max(1, min(168, remoteConfig.updateGracePeriodHours))
        let until = Date().addingTimeInterval(TimeInterval(hours * 60 * 60))
        updateDeferredUntil = until
        updateDeferredPair = remoteConfig.updatePairIdentifier
        UserDefaults.standard.set(until, forKey: updateDeferralUntilKey)
        UserDefaults.standard.set(remoteConfig.updatePairIdentifier, forKey: updateDeferralPairKey)
    }

    private func clearExpiredVersionUpdateDeferral() {
        guard let updateDeferredUntil else { return }
        if updateDeferredPair == remoteConfig.updatePairIdentifier, updateDeferredUntil > Date() {
            return
        }

        self.updateDeferredUntil = nil
        self.updateDeferredPair = nil
        UserDefaults.standard.removeObject(forKey: updateDeferralUntilKey)
        UserDefaults.standard.removeObject(forKey: updateDeferralPairKey)
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
        quantumService.accessToken = nextSession.accessToken
        hasEnteredApp = true
        await refreshPermissions()
    }

    func logout() {
        authService.logout()
        session = nil
        quantumService.accessToken = nil
        permissions = .free
        hasEnteredApp = false
    }

    func saveToLibrary(_ summary: MoleculeSummary) {
        libraryStore.save(summary)
    }
}
