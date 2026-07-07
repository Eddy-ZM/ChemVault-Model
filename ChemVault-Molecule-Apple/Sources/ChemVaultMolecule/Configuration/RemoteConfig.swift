import Foundation

struct RemoteAppConfig: Codable, Equatable {
    let maintenanceMode: Bool
    let enabledModules: [AppSection]
    let minimumSupportedVersion: String
    let latestVersion: String
    let resourceBundleVersion: String
    let announcementMessage: String
    let updateURL: String
    let updateMessage: String
    let updateGracePeriodHours: Int
    let updateCheckIntervalSeconds: Int

    static let fallback = RemoteAppConfig(
        maintenanceMode: false,
        enabledModules: AppSection.allCases,
        minimumSupportedVersion: "1.0.0",
        latestVersion: "1.0.0",
        resourceBundleVersion: "2026.06.28",
        announcementMessage: "",
        updateURL: "https://model.chemvault.science",
        updateMessage: "A newer ChemVault Molecule release is available.",
        updateGracePeriodHours: 24,
        updateCheckIntervalSeconds: 300
    )

    var enabledModuleIDs: [String] {
        enabledModules.map(\.remoteIdentifier).sorted()
    }

    func isSectionEnabled(_ section: AppSection) -> Bool {
        enabledModules.contains(section)
    }

    func supportsCurrentAppVersion() -> Bool {
        Bundle.main.appVersion.compare(minimumSupportedVersion, options: .numeric) != .orderedAscending
    }

    func isCurrentAppLatestVersion() -> Bool {
        Bundle.main.appVersion.compare(latestVersion, options: .numeric) != .orderedAscending
    }

    var updatePairIdentifier: String {
        "\(minimumSupportedVersion)->\(latestVersion)"
    }

    var updateDownloadURL: URL? {
        URL(string: updateURL)
    }

    private enum CodingKeys: String, CodingKey {
        case maintenanceMode
        case enabledModules
        case minimumSupportedVersion
        case latestVersion
        case resourceBundleVersion
        case announcementMessage
        case updateURL
        case downloadUrl
        case updateMessage
        case updateGracePeriodHours
        case allowDeferralHours
        case updateCheckIntervalSeconds
        case platforms
    }

    init(
        maintenanceMode: Bool,
        enabledModules: [AppSection],
        minimumSupportedVersion: String,
        latestVersion: String,
        resourceBundleVersion: String,
        announcementMessage: String,
        updateURL: String,
        updateMessage: String,
        updateGracePeriodHours: Int,
        updateCheckIntervalSeconds: Int
    ) {
        self.maintenanceMode = maintenanceMode
        self.enabledModules = enabledModules
        self.minimumSupportedVersion = minimumSupportedVersion
        self.latestVersion = latestVersion
        self.resourceBundleVersion = resourceBundleVersion
        self.announcementMessage = announcementMessage
        self.updateURL = updateURL
        self.updateMessage = updateMessage
        self.updateGracePeriodHours = updateGracePeriodHours
        self.updateCheckIntervalSeconds = updateCheckIntervalSeconds
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let fallback = Self.fallback
        let platformConfig = (try? container.decodeIfPresent([String: PlatformVersionConfig].self, forKey: .platforms))?["apple"]

        maintenanceMode = try container.decodeIfPresent(Bool.self, forKey: .maintenanceMode) ?? fallback.maintenanceMode

        let moduleIDs = try container.decodeIfPresent([String].self, forKey: .enabledModules)
            ?? fallback.enabledModules.map(\.remoteIdentifier)
        let decodedModules = moduleIDs.compactMap(AppSection.init(remoteIdentifier:))
        enabledModules = decodedModules.isEmpty ? fallback.enabledModules : decodedModules

        minimumSupportedVersion = platformConfig?.minimumSupportedVersion
            ?? (try container.decodeIfPresent(String.self, forKey: .minimumSupportedVersion))
            ?? fallback.minimumSupportedVersion
        latestVersion = platformConfig?.latestVersion
            ?? (try container.decodeIfPresent(String.self, forKey: .latestVersion))
            ?? minimumSupportedVersion
        resourceBundleVersion = try container.decodeIfPresent(String.self, forKey: .resourceBundleVersion)
            ?? fallback.resourceBundleVersion
        announcementMessage = try container.decodeIfPresent(String.self, forKey: .announcementMessage)
            ?? fallback.announcementMessage
        updateURL = platformConfig?.downloadUrl
            ?? platformConfig?.updateURL
            ?? (try container.decodeIfPresent(String.self, forKey: .downloadUrl))
            ?? (try container.decodeIfPresent(String.self, forKey: .updateURL))
            ?? fallback.updateURL
        updateMessage = platformConfig?.message
            ?? (try container.decodeIfPresent(String.self, forKey: .updateMessage))
            ?? fallback.updateMessage
        updateGracePeriodHours = platformConfig?.allowDeferralHours
            ?? (try container.decodeIfPresent(Int.self, forKey: .allowDeferralHours))
            ?? (try container.decodeIfPresent(Int.self, forKey: .updateGracePeriodHours))
            ?? fallback.updateGracePeriodHours
        updateCheckIntervalSeconds = platformConfig?.updateCheckIntervalSeconds
            ?? (try container.decodeIfPresent(Int.self, forKey: .updateCheckIntervalSeconds))
            ?? fallback.updateCheckIntervalSeconds
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(maintenanceMode, forKey: .maintenanceMode)
        try container.encode(enabledModules.map(\.remoteIdentifier), forKey: .enabledModules)
        try container.encode(minimumSupportedVersion, forKey: .minimumSupportedVersion)
        try container.encode(latestVersion, forKey: .latestVersion)
        try container.encode(resourceBundleVersion, forKey: .resourceBundleVersion)
        try container.encode(announcementMessage, forKey: .announcementMessage)
        try container.encode(updateURL, forKey: .updateURL)
        try container.encode(updateMessage, forKey: .updateMessage)
        try container.encode(updateGracePeriodHours, forKey: .updateGracePeriodHours)
        try container.encode(updateCheckIntervalSeconds, forKey: .updateCheckIntervalSeconds)
    }
}

private struct PlatformVersionConfig: Codable, Equatable {
    let version: String?
    let latestVersion: String?
    let minimumSupportedVersion: String?
    let updateURL: String?
    let downloadUrl: String?
    let message: String?
    let allowDeferralHours: Int?
    let updateCheckIntervalSeconds: Int?
}

enum RemoteConfigError: LocalizedError {
    case invalidResponse

    var errorDescription: String? {
        "Remote config returned an invalid response."
    }
}

extension Bundle {
    var appVersion: String {
        object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0.0"
    }

    var appBuildVersion: String {
        object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? appVersion
    }
}

extension AppSection {
    var remoteIdentifier: String {
        rawValue.lowercased()
    }

    init?(remoteIdentifier: String) {
        switch remoteIdentifier.lowercased() {
        case "model", "search":
            self = .search
        case "smiles":
            self = .smiles
        case "draw":
            self = .draw
        case "pdb", "structure":
            self = .pdb
        case "library", "file", "files":
            self = .library
        case "account", "user":
            self = .account
        default:
            self.init(rawValue: remoteIdentifier)
        }
    }
}
