import Foundation

enum QuantumCalculationMethod: String, CaseIterable, Identifiable, Codable, Sendable {
    case gfn2XTB = "gfn2-xTB"
    case gfn1XTB = "gfn1-xTB"
    case dftPBE0Def2SVP = "dft-pbe0-def2-svp"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .gfn2XTB: "GFN2-xTB"
        case .gfn1XTB: "GFN1-xTB"
        case .dftPBE0Def2SVP: "DFT PBE0/def2-SVP"
        }
    }

    var serviceValue: String {
        switch self {
        case .gfn2XTB: "gfn2-xTB"
        case .gfn1XTB: "gfn1-xTB"
        case .dftPBE0Def2SVP: "DFT PBE0/def2-SVP"
        }
    }

    var supportsLocalXTB: Bool {
        switch self {
        case .gfn2XTB, .gfn1XTB: true
        case .dftPBE0Def2SVP: false
        }
    }
}

enum QuantumEngineRoute: String, CaseIterable, Identifiable, Codable, Sendable {
    case automatic
    case localXTB
    case cloud

    var id: String { rawValue }

    var title: String {
        switch self {
        case .automatic: "Automatic"
        case .localXTB: "Local xTB"
        case .cloud: "Cloud engine"
        }
    }
}

enum QuantumCalculationStatus: String, Codable, Hashable, Sendable {
    case completed
    case unavailable
    case failed
}

struct QuantumVector3D: Codable, Hashable, Sendable {
    var x: Double
    var y: Double
    var z: Double

    var magnitude: Double {
        sqrt(x * x + y * y + z * z)
    }
}

struct QuantumAtomicCharge: Identifiable, Codable, Hashable, Sendable {
    var id: Int { atomIndex }
    var atomIndex: Int
    var element: String
    var charge: Double
}

struct QuantumCalculationResult: Identifiable, Hashable, Sendable {
    var id = UUID()
    var status: QuantumCalculationStatus
    var engine: String
    var method: String
    var totalEnergyHartree: Double?
    var homoLumoGapEV: Double?
    var dipoleDebye: QuantumVector3D?
    var atomCharges: [QuantumAtomicCharge]
    var runtimeSeconds: Double?
    var warnings: [String]
}
