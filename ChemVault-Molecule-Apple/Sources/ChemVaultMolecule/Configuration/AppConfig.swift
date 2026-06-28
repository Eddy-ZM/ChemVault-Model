import Foundation

struct AppConfig: Sendable {
    var userAPIBaseURL: URL
    var moleculeAPIBaseURL: URL
    var remoteConfigURL: URL
    var appScheme: String
    var bundleID: String

    static let production = AppConfig(
        userAPIBaseURL: URL(string: "https://user.chemvault.science")!,
        moleculeAPIBaseURL: URL(string: "https://model.chemvault.science/api/chem")!,
        remoteConfigURL: URL(string: "https://api.chemvault.science/app-config.json")!,
        appScheme: "chemvaultmolecule",
        bundleID: "science.chemvault.molecule"
    )
}
