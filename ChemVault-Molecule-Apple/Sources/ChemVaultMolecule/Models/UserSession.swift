import Foundation

struct UserSession: Codable, Hashable, Sendable {
    var accessToken: String
    var refreshToken: String?
    var user: ChemVaultUser
}

struct ChemVaultUser: Codable, Hashable, Identifiable, Sendable {
    var id: String
    var email: String
    var name: String?
    var membershipTier: MembershipTier

    var displayName: String { name?.isEmpty == false ? name! : email }
}

enum MembershipTier: String, Codable, Hashable, CaseIterable, Sendable {
    case free = "Free"
    case pro = "Pro"
    case research = "Research"
    case enterprise = "Enterprise"
}
