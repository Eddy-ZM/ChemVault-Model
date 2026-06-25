import AuthenticationServices
import Foundation

struct AuthService: Sendable {
    var config: AppConfig
    private let keychain = KeychainStore(service: "science.chemvault.molecule.session")

    func restoreSession() -> UserSession? {
        guard let data = keychain.read(key: "session") else { return nil }
        return try? JSONDecoder().decode(UserSession.self, from: data)
    }

    func login(email: String, password: String) async throws -> UserSession {
        guard !email.isEmpty, !password.isEmpty else { throw ChemVaultError.invalidInput("Enter email and password.") }
        var request = URLRequest(url: config.userAPIBaseURL.appending(path: "api/auth/app/login"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["email": email, "password": password])
        let (data, response) = try await URLSession.chemVault.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw ChemVaultError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else {
            throw ChemVaultError.requestFailed(http.statusCode, String(data: data, encoding: .utf8) ?? "Login failed.")
        }
        let session = try JSONDecoder().decode(UserSession.self, from: data)
        try save(session)
        return session
    }

    func save(_ session: UserSession) throws {
        let data = try JSONEncoder().encode(session)
        try keychain.save(data, key: "session")
    }

    func logout() {
        keychain.delete(key: "session")
    }
}
