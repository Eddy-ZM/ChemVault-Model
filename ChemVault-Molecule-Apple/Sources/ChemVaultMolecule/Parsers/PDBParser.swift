import Foundation

struct PDBParser: Sendable {
    func parse(_ text: String) throws -> Molecule3DModel {
        var atoms: [Atom3D] = []
        for line in text.split(whereSeparator: \.isNewline).map(String.init) {
            guard line.hasPrefix("ATOM") || line.hasPrefix("HETATM") else { continue }
            let x = doubleField(line, 30, 38)
            let y = doubleField(line, 38, 46)
            let z = doubleField(line, 46, 54)
            guard let x, let y, let z else { continue }
            let element = field(line, 76, 78).trimmingCharacters(in: .whitespaces).isEmpty ? inferElement(fromAtomName: field(line, 12, 16)) : field(line, 76, 78).trimmingCharacters(in: .whitespaces)
            atoms.append(Atom3D(element: element, x: x, y: y, z: z))
        }
        guard !atoms.isEmpty else { throw ChemVaultError.parserFailed("No ATOM or HETATM records were found.") }
        return Molecule3DModel(atoms: atoms, bonds: BondEstimator.estimateBonds(atoms: atoms, maxAtomsForBonding: 600))
    }

    private func field(_ line: String, _ start: Int, _ end: Int) -> String {
        let characters = Array(line)
        guard characters.count > start else { return "" }
        return String(characters[start..<min(end, characters.count)])
    }

    private func doubleField(_ line: String, _ start: Int, _ end: Int) -> Double? {
        Double(field(line, start, end).trimmingCharacters(in: .whitespaces))
    }

    private func inferElement(fromAtomName name: String) -> String {
        let letters = name.filter { $0.isLetter }
        guard let first = letters.first else { return "C" }
        return String(first).uppercased()
    }
}
