import Foundation

struct BondEstimator {
    static func estimateBonds(atoms: [Atom3D], maxAtomsForBonding: Int = 250) -> [Bond3D] {
        guard atoms.count <= maxAtomsForBonding else { return [] }
        var bonds: [Bond3D] = []
        for i in atoms.indices {
            for j in atoms.indices where j > i {
                let distance = distance(atoms[i], atoms[j])
                let threshold = covalentRadius(atoms[i].element) + covalentRadius(atoms[j].element) + 0.45
                if distance > 0.35 && distance <= threshold {
                    bonds.append(Bond3D(atom1: atoms[i].id, atom2: atoms[j].id, order: 1))
                }
            }
        }
        return bonds
    }

    private static func distance(_ a: Atom3D, _ b: Atom3D) -> Double {
        let dx = a.x - b.x
        let dy = a.y - b.y
        let dz = a.z - b.z
        return sqrt(dx * dx + dy * dy + dz * dz)
    }

    private static func covalentRadius(_ element: String) -> Double {
        switch element.capitalized {
        case "H": 0.31
        case "C": 0.76
        case "N": 0.71
        case "O": 0.66
        case "F": 0.57
        case "P": 1.07
        case "S": 1.05
        case "Cl": 1.02
        case "Br": 1.20
        case "I": 1.39
        default: 0.85
        }
    }
}
