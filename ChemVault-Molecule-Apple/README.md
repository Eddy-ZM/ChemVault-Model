# ChemVault Molecule Apple App

ChemVault Molecule is a native Apple molecule application for iOS, iPadOS, and macOS. It is not a WebView wrapper. The core app is implemented with SwiftUI, URLSession, Codable, Keychain, and SceneKit.

## Why this is not WebView

The app does not embed `model.chemvault.science/molecule` as the main interface. Search, SMILES input, native drawing, PDB loading, molecule details, permissions, library, and 3D rendering are implemented with native SwiftUI views and API clients.

Allowed web usage is limited to opening the ChemVault User Portal or future authentication pages through system browser/authentication flows.

## Supported Platforms

- iOS 17+
- iPadOS 17+
- macOS 14+
- visionOS is listed in the package platforms for future work, but the SceneKit viewer should be reviewed before shipping on visionOS.

## Project Shape

This directory is a Swift Package plus source tree designed for Xcode import:

```text
ChemVault-Molecule-Apple/
  Package.swift
  Sources/ChemVaultMolecule/
    App/
    Configuration/
    Models/
    Services/
    Parsers/
    Views/
```

For App Store work, the recommended route is to create a real Xcode Multiplatform App target and drag `Sources/ChemVaultMolecule` into it.

## API Configuration

Defaults are defined in `Configuration/AppConfig.swift`:

```text
userAPIBaseURL = https://user.chemvault.science
moleculeAPIBaseURL = https://model.chemvault.science/api/chem
appScheme = chemvaultmolecule
bundleID = science.chemvault.molecule
```

The app calls JSON/SDF/PDB APIs. It does not inspect or depend on React DOM.

## Login and Permissions

Implemented pieces:

- `AuthService` supports a proposed `POST /api/auth/app/login` contract.
- Access tokens are stored in Keychain using `KeychainStore`.
- Passwords are never stored.
- `PermissionsService` calls `GET /api/apps/molecule/permissions`.
- If permissions fail, the app falls back to Free limited mode.
- `PermissionLockedView` gates protected features.

Future production recommendation:

- Add OAuth or token handoff through `ASWebAuthenticationSession`.
- Keep all server secrets on ChemVault servers, never in the app.

## Native Features in this MVP

- `SearchView`: searches molecules by name or CID through ChemVault Molecule API.
- `SmilesInputView`: accepts SMILES and opens a native detail page.
- `DrawView`: native SwiftUI Canvas sketcher MVP with atoms, single bonds, erase, undo, redo, clear, and a 36-element periodic table.
- `PDBView`: loads PDB structures through the Molecule API and parses ATOM/HETATM coordinates.
- `MoleculeDetailView`: native molecule detail screen with 3D viewer and metadata.
- `NativeMolecule3DView`: SceneKit ball-and-stick, sphere, and stick display modes.
- `LibraryView`: local saved molecule list and file import.
- `AccountView`: login state, membership tier, permission summary, quotas, portal link, logout.
- Parsers for MOL/SDF/XYZ/PDB and fallback bond estimation.

## Xcode Setup

Option A: open the Swift Package directly for development.

1. Open Xcode.
2. Choose `File -> Open`.
3. Select `ChemVault-Molecule-Apple/Package.swift`.
4. Build the `ChemVaultMolecule` executable target on macOS.

Option B: create the final Apple app target.

1. Open Xcode.
2. Create a new `Multiplatform App`.
3. Product Name: `ChemVaultMolecule`.
4. Bundle Identifier: `science.chemvault.molecule`.
5. Minimum deployments: iOS 17, iPadOS 17, macOS 14.
6. Delete the default generated Swift files if needed.
7. Drag `Sources/ChemVaultMolecule` into the Xcode project.
8. Ensure files are added to the iOS, iPadOS, and macOS targets.
9. Set your Apple Development Team under Signing & Capabilities.
10. Add URL scheme `chemvaultmolecule` when OAuth callback support is added.
11. Run on iPhone, iPad, or Mac.

## Molecule API Endpoints Used

- `GET /api/chem/pubchem/search?query=`
- `GET /api/chem/pubchem/structure?cid=&format=sdf3d`
- `POST /api/chem/properties`
- `POST /api/chem/generate-3d`
- `GET /api/chem/pdb/{id}`

## User API Endpoints Expected

- `POST /api/auth/app/login`
- `GET /api/apps/molecule/permissions`

If the current user system does not provide these yet, the app can still run in Free limited mode.

## Security Notes

- No OpenAI keys or server secrets are included.
- No hardcoded user tokens are included.
- Tokens are stored in Keychain.
- The app does not depend on localhost.

## Current Limitations

- DrawView generates SMILES only for simple acyclic sketches; complex ring and stereochemistry support is a later phase.
- PDB rendering is atom/bond estimated, not full ribbon/cartoon yet.
- SceneKit viewer supports ball-and-stick, sphere, and stick modes; labels and screenshots are TODO.
- Real OAuth via ASWebAuthenticationSession is not wired until ChemVault-user exposes an app auth flow.
- Cloud library sync is reserved for Pro or higher tiers later.

## Build Check

From this directory:

```bash
swift build
```

For the production app bundle, use Xcode Multiplatform App as described above.

## GitHub Setup

If this directory is not already connected to GitHub:

```bash
git remote add origin https://github.com/Eddy-ZM/ChemVault-Molecule-Apple.git
git branch -M main
git push -u origin main
```
