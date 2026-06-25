// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "ChemVaultMolecule",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
        .macCatalyst(.v17),
        .visionOS(.v1)
    ],
    products: [
        .executable(name: "ChemVaultMolecule", targets: ["ChemVaultMolecule"])
    ],
    targets: [
        .executableTarget(name: "ChemVaultMolecule")
    ]
)
