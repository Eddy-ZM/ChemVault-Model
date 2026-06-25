import Foundation

struct SDFParser: Sendable {
    func parse(_ text: String) throws -> Molecule3DModel {
        let molBlock = text.components(separatedBy: "$$$$").first ?? text
        return try MolfileParser().parse(molBlock)
    }
}
