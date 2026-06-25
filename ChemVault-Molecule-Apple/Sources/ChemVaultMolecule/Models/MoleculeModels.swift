import Foundation

struct MoleculeSummary: Identifiable, Codable, Hashable, Sendable {
    var id: UUID = UUID()
    var name: String
    var cid: String?
    var canonicalSMILES: String?
    var formula: String?
    var molecularWeight: Double?
    var inchi: String?
    var inchiKey: String?
    var iupacName: String?
    var source: MoleculeSource
    var structureData: String?
    var structureFormat: MoleculeFileFormat?
    var pdbID: String?
    var fileName: String?
    var properties: MoleculeProperties?
    var model: Molecule3DModel?

    static let empty = MoleculeSummary(name: "Untitled Molecule", source: .manual)
}

enum MoleculeSource: String, Codable, Hashable, Sendable {
    case search
    case smiles
    case draw
    case upload
    case pdb
    case manual
}

struct MoleculeProperties: Codable, Hashable, Sendable {
    var formula: String?
    var molecularWeight: Double?
    var exactMass: Double?
    var logP: Double?
    var tpsa: Double?
    var hbd: Int?
    var hba: Int?
    var rotatableBonds: Int?
    var ringCount: Int?
    var heavyAtomCount: Int?
    var formalCharge: Int?
}

struct MoleculeFile: Codable, Hashable, Sendable {
    var format: MoleculeFileFormat
    var data: String
    var optimized: Bool?
    var method: String?
}

enum MoleculeFileFormat: String, Codable, Hashable, Sendable {
    case mol
    case sdf
    case xyz
    case pdb
    case cif
    case smiles
    case json
    case unknown
}

struct MoleculeProject: Identifiable, Codable, Hashable, Sendable {
    var id: UUID = UUID()
    var summary: MoleculeSummary
    var savedAt: Date = Date()
    var isFavorite: Bool = false
}
