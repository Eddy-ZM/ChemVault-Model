# Xcode Cloud Setup

This repository contains a native SwiftUI molecule app implemented as a Swift Package:

`ChemVault-Molecule-Apple/Package.swift`

The package product is `ChemVaultMolecule`, and the app Bundle ID declared in code is `science.chemvault.molecule`.

## Current State

- Native SwiftUI app source exists.
- `Package.swift` is tracked.
- No `.xcodeproj` or `.xcworkspace` exists for an App Store app target.
- No AppIcon asset catalog exists for the Swift Package app.
- No app target signing settings, generated Info.plist settings or entitlements exist.

Because of that, this package can be useful for local development and source builds, but it is not yet ready for Xcode Cloud Archive + TestFlight distribution by itself.

## Required Before TestFlight

Create an Xcode app project or app target that wraps the package source with:

- Bundle ID: `science.chemvault.molecule`.
- Shared scheme for the app target.
- Automatically manage signing enabled.
- Apple Developer Team `96L6379Q92` selected.
- Xcode/Apple Developer signing account/name shown as `Ziwen Mu`.
- AppIcon asset catalog.
- Generated or explicit Info.plist.
- iOS/iPadOS deployment target that Xcode Cloud supports.
- App Store Connect app record with the same Bundle ID.

## Recommended Workflow After App Target Exists

- Trigger: push to the `main` branch.
- Scheme: the shared app scheme, for example `ChemVaultMolecule`.
- Action: Build.
- Archive: enabled.
- Distribution: TestFlight.
- Environment: latest stable Xcode available in Xcode Cloud.

## Remote Config

The Swift Package app now reads `https://api.chemvault.science/app-config.json` on startup and falls back to bundled defaults if the request fails. Remote config controls maintenance mode, enabled modules, minimum supported version, resource bundle version and announcement message.
