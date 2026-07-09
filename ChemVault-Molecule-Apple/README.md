# ChemVault Molecule Apple App

ChemVault Molecule Apple App is the native SwiftUI version of ChemVault Molecule Studio for iOS, iPadOS, and macOS.

This document describes the app feature scope only.

## Platforms

- iOS 17+
- iPadOS 17+
- macOS 14+

## App Structure

The Apple app uses native screens for:

- Search
- SMILES
- Draw
- PDB
- Library
- Account
- Settings

iPhone uses bottom tabs. iPad and macOS use a sidebar layout.

## Search

- Search by molecule name or PubChem CID.
- Use built-in examples such as water, ethanol, benzene, caffeine, aspirin, paracetamol, ibuprofen, and glucose.
- Open search results in molecule details.
- Continue from details into 3D viewing and property inspection.

## SMILES

- Enter or paste SMILES.
- Use example shortcuts.
- Load a valid SMILES into molecule details.

## Draw

- Draw basic molecular sketches natively.
- Place atoms and create bonds.
- Select, erase, undo, redo, and clear.
- Choose common elements.
- Convert simple sketches into SMILES for follow-up viewing.

## PDB

- Load structures by four-character PDB ID.
- Use examples such as 1CRN, 4HHB, and 1BNA.
- View loaded protein or nucleic-acid structures in molecule details.

## Molecule Details

- View 3D molecular structures.
- Switch supported display modes.
- Review name, formula, molecular weight, canonical SMILES, InChIKey, IUPAC name, source, PDB ID, and file name where available.
- Save molecules to the local library.
- Share structure summaries.
- Copy SMILES.
- Export XYZ text.

## Library

- Save molecules from detail pages.
- Review local saved molecules.
- Delete local saved molecules.
- Import MOL, SDF, XYZ, PDB, SMILES, and text files.
- Reopen imported structures in molecule details.

## Account

- Show free-mode and signed-in states.
- Display user name, membership tier, permissions, search quota, export quota, and saved-project quota.
- Refresh permissions.
- Open the ChemVault User Portal.
- Sign out.

## Quantum Boundary

The Apple app can display local or cloud quantum results where configured by ChemVault services. High-precision local Gaussian, ORCA, PySCF, and Windows engine-setup workflows belong to the Windows ChemVault Model desktop app.

The Apple app does not require bundled Gaussian, ORCA, PySCF, or xTB integration for this project stage.
