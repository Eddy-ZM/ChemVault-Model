import Foundation

struct MolfileParser: Sendable {
    func parse(_ text: String) throws -> Molecule3DModel {
        let lines = text.split(whereSeparator: \.isNewline).map(String.init)
        guard lines.count >= 4 else { throw ChemVaultError.parserFailed("Molfile is too short.") }
        let countsLine = lines[3]
        let atomCount = fixedWidthInt(countsLine, 0, 3)
        let bondCount = fixedWidthInt(countsLine, 3, 6)
        guard atomCount > 0, lines.count >= 4 + atomCount else { throw ChemVaultError.parserFailed("Molfile atom block is missing.") }

        var atoms: [Atom3D] = []
        for index in 0..<atomCount {
            let line = lines[4 + index]
            let fields = line.split(separator: " ").map(String.init)
            guard fields.count >= 4, let x = Double(fields[0]), let y = Double(fields[1]), let z = Double(fields[2]) else {
                throw ChemVaultError.parserFailed("Invalid atom line at \(index + 1).")
            }
            atoms.append(Atom3D(element: fields[3], x: x, y: y, z: z))
        }

        var bonds: [Bond3D] = []
        for index in 0..<bondCount where 4 + atomCount + index < lines.count {
            let line = lines[4 + atomCount + index]
            let fields = line.split(separator: " ").map(String.init)
            guard fields.count >= 3, let a = Int(fields[0]), let b = Int(fields[1]) else { continue }
            let order = Int(fields[2]) ?? 1
            if atoms.indices.contains(a - 1), atoms.indices.contains(b - 1) {
                bonds.append(Bond3D(atom1: atoms[a - 1].id, atom2: atoms[b - 1].id, order: max(1, min(order, 3))))
            }
        }

        if bonds.isEmpty { bonds = BondEstimator.estimateBonds(atoms: atoms) }
        return Molecule3DModel(atoms: atoms, bonds: bonds)
    }

    private func fixedWidthInt(_ line: String, _ start: Int, _ end: Int) -> Int {
        let characters = Array(line)
        guard characters.count >= end else { return 0 }
        return Int(String(characters[start..<end]).trimmingCharacters(in: .whitespaces)) ?? 0
    }
}
