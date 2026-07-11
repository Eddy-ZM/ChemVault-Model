# Xcode Cloud and Apple build setup

The native SwiftUI app source and XcodeGen wrapper specification live in `ChemVault-Molecule-Apple`.

- XcodeGen spec: `ChemVault-Molecule-Apple/project.yml`
- iOS scheme: `ChemVaultMolecule-iOS`
- macOS scheme: `ChemVaultMolecule-macOS`
- iOS bundle ID: `science.chemvault.molecule`
- macOS bundle ID: `science.chemvault.molecule.mac`
- Apple Developer Team: `96L6379Q92`

The repository CI generates `ChemVaultMolecule.xcodeproj` from the committed specification and performs unsigned iOS Simulator and macOS builds. This removes generated-project drift while keeping the Xcode wrapper reproducible.

On macOS, generate the project before opening it:

```bash
brew install xcodegen
cd ChemVault-Molecule-Apple
xcodegen generate --spec project.yml
open ChemVaultMolecule.xcodeproj
```

For Xcode Cloud, generate and commit the project once from a trusted macOS checkout, then create workflows for the two shared schemes. Keep automatic signing enabled and use Team `96L6379Q92`. Final archive, signing, App Store Connect association, and TestFlight upload require the Apple account and cannot be validated on Windows.
