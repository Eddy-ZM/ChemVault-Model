import Foundation

enum ChemVaultError: LocalizedError, Sendable {
    case invalidInput(String)
    case invalidResponse
    case requestFailed(Int, String)
    case decodingFailed(String)
    case unsupportedFormat(String)
    case parserFailed(String)
    case missingData(String)

    var errorDescription: String? {
        switch self {
        case .invalidInput(let message): message
        case .invalidResponse: "The server returned an invalid response."
        case .requestFailed(let code, let message): "Request failed (\(code)): \(message)"
        case .decodingFailed(let message): "Could not decode response: \(message)"
        case .unsupportedFormat(let format): "Unsupported format: \(format)"
        case .parserFailed(let message): "Could not parse structure: \(message)"
        case .missingData(let message): message
        }
    }
}

extension URLSession {
    static let chemVault: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 25
        configuration.timeoutIntervalForResource = 45
        return URLSession(configuration: configuration)
    }()
}

struct EmptyRequestBody: Encodable {}
