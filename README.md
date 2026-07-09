# ChemVault Molecule Studio

ChemVault Molecule Studio is a ChemVault application for molecule search, 2D input, file import, 3D visualization, structure export, and desktop quantum-calculation workflows.

This README describes the website, Windows desktop app, and Apple app feature scope. It does not document internal implementation details.

## Website

The web version provides the Molecule Studio workspace at:

```text
https://model.chemvault.science/molecule
```

Main website capabilities:

- Search compounds by name, synonym, close spelling, SMILES-like input, or PubChem CID.
- Load common example molecules such as water, ethanol, benzene, caffeine, aspirin, paracetamol, ibuprofen, and glucose.
- Enter or paste SMILES and generate a 3D structure for inspection.
- Draw basic 2D molecular structures, choose elements from a periodic table, and generate molecule input from the sketch.
- Upload local structure files including MOL, SDF, XYZ, PDB, CIF, SMILES, and text files.
- Load PDB structures by four-character PDB ID.
- Inspect molecule identifiers, formula, molecular weight, exact mass, LogP, TPSA, hydrogen-bond counts, rotatable bonds, rings, formal charge, SMILES, InChI, and InChIKey.
- View molecules in 3D with ball-and-stick, stick, sphere, line, surface, space-filling, and PDB cartoon modes where appropriate.
- Toggle hydrogens, atom labels, background color, and viewer reset.
- Export structure files and PNG viewer images with user-selected naming style.
- Use ChemVault account entry points for Profile, My Molecules, Settings, sign-in, and account creation.

The web version includes an approximate electrostatic standard for loaded 3D structures. It is labeled as an approximate browser-side model and reports estimated partial charges, dipole vector, charge separation, and related warnings.

## Windows Desktop App

ChemVault Model is the Windows desktop application package for Molecule Studio. It keeps the website workspace and adds Windows-only local desktop capabilities.

Desktop app title:

```text
ChemVault Model
```

Desktop user experience:

- Opens as a standalone Windows application, not as a browser tab.
- Starts with the ChemVault Molecule Studio welcome screen.
- Uses a desktop-size, resizable window suitable for 1280 x 800 and larger displays.
- Preserves the website layout, navigation, controls, visual style, 2D input workflows, file upload, WebGL/3Dmol rendering, and export behavior.

### Professional Quantum Calculation

The Windows desktop app adds a professional calculation workspace for users who want local or user-licensed quantum engines.

Supported calculation paths:

- xTB GFN2 local semiempirical screening.
- Managed or existing PySCF DFT/HF setup for local open-source calculations.
- External Gaussian port for a locally installed, properly licensed Gaussian executable.
- External ORCA port for a locally installed, properly licensed ORCA executable.

The app does not ship commercial engines. Users connect their own licensed installations.

Professional workflow features:

- Engine readiness check before calculation.
- Structure, charge, spin, electron-count, fragment, hydrogen, and geometry preflight checks.
- XYZ standardization before calculation.
- Calculation progress overlay with live stage, elapsed time, progress estimate, and real engine output tail.
- Cancellable desktop calculations.
- Local calculation queue for running multiple calculations in sequence.
- Optional xTB screening followed by Gaussian refinement.
- Local ChemVault project workspace that groups repeated calculations by molecule.
- Result comparison table across current and recent calculations.
- 3D viewer quantum overlay for parsed partial charges and dipole summary.
- Local history visible in Molecule Studio and My Molecules.
- Engine diagnostics for configured local and external engines.
- Error review and repair suggestions for common Gaussian failures.

### Gaussian Bridge

Gaussian bridge features:

- Save Gaussian executable path, method, basis set, and route options.
- Auto-detect Gaussian where possible.
- Preview the generated Gaussian input.
- Export current GJF before running.
- Apply Gaussian route templates for single point, optimization, frequency, Opt+Freq, TD-DFT, NMR, solvent, transition-state search, IRC, stability, frontier orbital output, and NBO where supported by the local installation.
- Parse Gaussian energy, dipole, Mulliken or natural population charges, HOMO/LUMO values, gap, frequency summary, thermochemistry, TD-DFT excited states, NMR shielding, and optimized geometry when present in the output.
- Export native Gaussian files as a suite: GJF, TXT, CHK when available, FCHK, CUBE, and optimized XYZ.
- Generate FCHK through the local Gaussian `formchk` tool when available.
- Generate CUBE files through the local Gaussian `cubegen` tool when available.
- Open generated bridge files in GaussView when installed.

### Calculation Exports

Completed calculation exports include:

- HTML report.
- Excel workbook.
- Word document.
- PDF report with ChemVault footer and page numbers.
- Plain-text engine log.
- Optimized XYZ when available.
- Gaussian suite ZIP for Gaussian-native follow-up work.
- Local ChemVault project JSON bundle.

Report exports include document properties and ChemVault copyright metadata.

## Apple App

The Apple app is a native SwiftUI multi-platform app for iOS, iPadOS, and macOS. It is not a WebView wrapper.

Supported Apple app platforms:

- iOS 17+
- iPadOS 17+
- macOS 14+

Apple app capabilities:

- Molecule search by name or CID.
- SMILES input.
- Basic native drawing.
- PDB loading.
- Native 3D molecule viewing.
- Local molecule library.
- Account and permission display.
- Local or cloud quantum result display where available.

High-precision Gaussian bridge workflows are Windows desktop app features. The Apple app does not require Gaussian, ORCA, PySCF, or xTB integration for this project stage.

## Commands

Install dependencies:

```bash
npm install
```

Run the web version:

```bash
npm run dev
```

Run the desktop version locally:

```bash
npm run dev:desktop
```

Build the website:

```bash
npm run build
```

Build the Windows installer and portable executable:

```bash
npm run build:desktop
```

Generate release manifest and checksums for the existing Windows release directory:

```bash
npm run release:manifest
```

Run parser and export smoke tests:

```bash
npm test
```

## Windows Release Output

Windows artifacts are written to:

```text
release/windows/v0.1.0/
```

Expected Windows outputs:

```text
ChemVault-Model-Setup-0.1.0-win-x64.exe
ChemVault-Model-Portable-0.1.0-win-x64.exe
release-manifest.json
release-notes.md
```

Windows EXE builds should be produced on Windows. GitHub Actions also builds the Windows artifacts on `windows-latest` and uploads them as:

```text
ChemVault-Model-Windows
```

Windows code signing is not configured in this release.
