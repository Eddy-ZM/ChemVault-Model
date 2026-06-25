import Foundation

struct XYZParser: Sendable {
    func parse(_ text: String) throws -> Molecule3DModel {
        let lines = text.split(whereSeparator: \ .isNewline).map(String.init)
        guard let count = Int(lines.first?.trimmingCharacters(in: .whitespaces) ?? ""), lines.count >= count + 2 else {
            throw ChemVaultError.parserFailed("XYZ file is missing atom count or coordinates.")
        }
        var atoms: [Atom3D] = []
        for line in lines.dropFirst(2).prefix(count) {
            let fields = line.split(separator: " ").map(String.init)
            guard fields.count >= 4, let x = Double(fields[1]), let y = Double(fields[2]), let z = Double(fields[3]) else { continue }
            atoms.append(Atom3D(element: fields[0], x: x, y: y, z: z))
        }
        return Molecule3DModel(atoms: atoms, bonds: BondEstimator.estimateBonds(atoms: atoms))
    }
}
