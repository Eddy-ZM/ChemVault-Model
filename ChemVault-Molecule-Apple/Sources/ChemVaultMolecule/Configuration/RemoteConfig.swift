import Foundation

struct RemoteAppConfig: Codable, Equatable {
    let maintenanceMode: Bool
    let enabledModules: [AppSection]
    let minimumSupportedVersion: String
    let resourceBundleVersion: String
    let announcementMessage: String

    static let fallback = RemoteAppConfig(
        maintenanceMode: false,
        enabledModules: AppSection.allCases,
        minimumSupportedVersion: "1.0.0",
        resourceBundleVersion: "2026.06.28",
        announcementMessage: ""
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

    private enum CodingKeys: String, CodingKey {
        case maintenanceMode
        case enabledModules
        case minimumSupportedVersion
        case resourceBundleVersion
        case announcementMessage
    }

    init(
        maintenanceMode: Bool,
        enabledModules: [AppSection],
        minimumSupportedVersion: String,
        resourceBundleVersion: String,
        announcementMessage: String
    ) {
        self.maintenanceMode = maintenanceMode
        self.enabledModules = enabledModules
        self.minimumSupportedVersion = minimumSupportedVersion
        self.resourceBundleVersion = resourceBundleVersion
        self.announcementMessage = announcementMessage
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let fallback = Self.fallback

        maintenanceMode = try container.decodeIfPresent(Bool.self, forKey: .maintenanceMode) ?? fallback.maintenanceMode

        let moduleIDs = try container.decodeIfPresent([String].self, forKey: .enabledModules)
            ?? fallback.enabledModules.map(\.remoteIdentifier)
        let decodedModules = moduleIDs.compactMap(AppSection.init(remoteIdentifier:))
        enabledModules = decodedModules.isEmpty ? fallback.enabledModules : decodedModules

        minimumSupportedVersion = try container.decodeIfPresent(String.self, forKey: .minimumSupportedVersion)
            ?? fallback.minimumSupportedVersion
        resourceBundleVersion = try container.decodeIfPresent(String.self, forKey: .resourceBundleVersion)
            ?? fallback.resourceBundleVersion
        announcementMessage = try container.decodeIfPresent(String.self, forKey: .announcementMessage)
            ?? fallback.announcementMessage
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(maintenanceMode, forKey: .maintenanceMode)
        try container.encode(enabledModules.map(\.remoteIdentifier), forKey: .enabledModules)
        try container.encode(minimumSupportedVersion, forKey: .minimumSupportedVersion)
        try container.encode(resourceBundleVersion, forKey: .resourceBundleVersion)
        try container.encode(announcementMessage, forKey: .announcementMessage)
    }
}

enum RemoteConfigError: LocalizedError {
    case invalidResponse

    var errorDescription: String? {
        "Remote config returned an invalid response."
    }
}

private extension Bundle {
    var appVersion: String {
        object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0.0"
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
