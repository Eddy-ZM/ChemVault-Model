import CoreGraphics
import Foundation

enum DrawTool: String, CaseIterable, Identifiable {
    case select = "Select"
    case atom = "Atom"
    case bond = "Bond"
    case erase = "Erase"
    case fit = "Fit"

    var id: String { rawValue }
}

struct SketchAtom: Identifiable, Codable, Hashable {
    var id = UUID()
    var element: String
    var x: Double
    var y: Double
}

struct SketchBond: Identifiable, Codable, Hashable {
    var id = UUID()
    var atom1: UUID
    var atom2: UUID
    var order: Int
}

struct MoleculeGraph: Codable, Hashable {
    var atoms: [SketchAtom] = []
    var bonds: [SketchBond] = []

    var isEmpty: Bool { atoms.isEmpty }

    func generateSMILES() -> String? {
        guard !atoms.isEmpty else { return nil }
        if atoms.count == 1 { return atomToSmiles(atoms[0].element) }
        guard bonds.count == atoms.count - 1 else { return nil }

        var adjacency: [UUID: [(UUID, SketchBond)]] = [:]
        atoms.forEach { adjacency[$0.id] = [] }
        bonds.forEach { bond in
            adjacency[bond.atom1, default: []].append((bond.atom2, bond))
            adjacency[bond.atom2, default: []].append((bond.atom1, bond))
        }
        let start = atoms.first { (adjacency[$0.id]?.count ?? 0) <= 1 } ?? atoms[0]
        var visited = Set<UUID>()
        func walk(_ id: UUID, parent: UUID?) -> String {
            visited.insert(id)
            guard let atom = atoms.first(where: { $0.id == id }) else { return "" }
            let neighbors = (adjacency[id] ?? []).filter { $0.0 != parent && !visited.contains($0.0) }
            guard let first = neighbors.first else { return atomToSmiles(atom.element) }
            let branches = neighbors.dropFirst().map { "(\(bondSymbol($0.1.order))\(walk($0.0, parent: id)))" }.joined()
            return "\(atomToSmiles(atom.element))\(branches)\(bondSymbol(first.1.order))\(walk(first.0, parent: id))"
        }
        return walk(start.id, parent: nil)
    }

    private func atomToSmiles(_ element: String) -> String {
        ["B", "C", "N", "O", "P", "S", "F", "Cl", "Br", "I"].contains(element) ? element : "[\(element)]"
    }

    private func bondSymbol(_ order: Int) -> String {
        order == 2 ? "=" : order == 3 ? "#" : ""
    }
}
