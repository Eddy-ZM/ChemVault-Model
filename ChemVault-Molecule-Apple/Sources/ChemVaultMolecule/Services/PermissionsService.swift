import Foundation

struct PermissionsService: Sendable {
    var config: AppConfig

    func fetchPermissions(accessToken: String?) async throws -> MoleculePermissions {
        var request = URLRequest(url: config.userAPIBaseURL.appending(path: "api/apps/molecule/permissions"))
        if let accessToken { request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization") }
        let (data, response) = try await URLSession.chemVault.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw ChemVaultError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else { throw ChemVaultError.requestFailed(http.statusCode, "Permissions API unavailable.") }
        return try JSONDecoder().decode(MoleculePermissions.self, from: data)
    }
}
