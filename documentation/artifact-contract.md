# Molecule artifact contract

Gaussian suite exports include `ChemVault/artifact-manifest.json` using `chemvault.artifact.v1`. The manifest identifies ChemVault Molecule as generator, records engine and calculation settings, carries run-manifest provenance hashes, and lists the files in the bundle.

This envelope is intended for later ingestion into ChemVault Files without treating Notifications as a record store.
