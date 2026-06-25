import Foundation

struct Atom3D: Identifiable, Codable, Hashable, Sendable {
    var id: UUID = UUID()
    var element: String
    var x: Double
    var y: Double
    var z: Double
}

struct Bond3D: Identifiable, Codable, Hashable, Sendable {
    var id: UUID = UUID()
    var atom1: UUID
    var atom2: UUID
    var order: Int
}

struct Molecule3DModel: Codable, Hashable, Sendable {
    var atoms: [Atom3D]
    var bonds: [Bond3D]

    var isEmpty: Bool { atoms.isEmpty }

    static let empty = Molecule3DModel(atoms: [], bonds: [])
}
