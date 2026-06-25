import Foundation

struct StructureParser: Sendable {
    func parse(data: String, format: MoleculeFileFormat) throws -> Molecule3DModel {
        switch format {
        case .mol: try MolfileParser().parse(data)
        case .sdf: try SDFParser().parse(data)
        case .xyz: try XYZParser().parse(data)
        case .pdb: try PDBParser().parse(data)
        default: throw ChemVaultError.unsupportedFormat(format.rawValue)
        }
    }

    func parseImportedFile(name: String, data: Data) throws -> ImportedStructure {
        guard let text = String(data: data, encoding: .utf8) else { throw ChemVaultError.parserFailed("File is not UTF-8 text.") }
        let lower = name.lowercased()
        if lower.hasSuffix(".smi") || lower.hasSuffix(".smiles") || lower.hasSuffix(".txt") {
            let firstLine = text.split(whereSeparator: \ .isNewline).first.map(String.init) ?? ""
            return .smiles(firstLine.trimmingCharacters(in: .whitespacesAndNewlines))
        }
        let format: MoleculeFileFormat
        if lower.hasSuffix(".mol") { format = .mol }
        else if lower.hasSuffix(".sdf") { format = .sdf }
        else if lower.hasSuffix(".xyz") { format = .xyz }
        else if lower.hasSuffix(".pdb") { format = .pdb }
        else { throw ChemVaultError.unsupportedFormat(name) }
        return .model(try parse(data: text, format: format), format, text)
    }
}

enum ImportedStructure: Sendable {
    case smiles(String)
    case model(Molecule3DModel, MoleculeFileFormat, String)
}
