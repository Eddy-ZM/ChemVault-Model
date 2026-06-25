import Foundation

struct MoleculePermissions: Codable, Hashable, Sendable {
    var authenticated: Bool
    var membershipTier: MembershipTier
    var permissions: Set<String>
    var featureFlags: FeatureFlags
    var quota: Quota

    static let free = MoleculePermissions(
        authenticated: false,
        membershipTier: .free,
        permissions: [
            "molecule.search",
            "molecule.smiles.input",
            "molecule.draw.access",
            "molecule.draw.periodic_table",
            "molecule.pdb.access"
        ],
        featureFlags: FeatureFlags(),
        quota: Quota(searchesRemaining: 50, exportsRemaining: 5, savedProjectsRemaining: 10)
    )

    func allows(_ permission: MoleculePermission) -> Bool {
        permissions.contains(permission.rawValue)
    }
}

enum MoleculePermission: String, CaseIterable, Sendable {
    case search = "molecule.search"
    case smilesInput = "molecule.smiles.input"
    case drawAccess = "molecule.draw.access"
    case periodicTable = "molecule.draw.periodic_table"
    case upload = "molecule.upload"
    case pdbAccess = "molecule.pdb.access"
    case advancedViewer = "molecule.viewer.advanced"
    case export = "molecule.export"
    case savedProjects = "molecule.saved_projects"
}

struct FeatureFlags: Codable, Hashable, Sendable {
    var nativeSketcherEnabled: Bool = true
    var cloudLibrarySyncEnabled: Bool = false
    var advancedViewerEnabled: Bool = false
}

struct Quota: Codable, Hashable, Sendable {
    var searchesRemaining: Int?
    var exportsRemaining: Int?
    var savedProjectsRemaining: Int?
}
