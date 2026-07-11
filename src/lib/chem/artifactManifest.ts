import type { QuantumCalculationResult } from "./quantumTypes";

export function buildMoleculeArtifactManifest(
  result: QuantumCalculationResult,
  files: Array<{ path: string }>,
) {
  return {
    schemaVersion: "chemvault.artifact.v1",
    artifactType: "molecule.quantum-calculation-suite",
    createdAt: new Date().toISOString(),
    generator: {
      product: "ChemVault Molecule",
      engine: result.engine,
      engineVersion: result.engineVersion || result.runManifest?.engine.version || null,
    },
    status: result.ok ? "completed" : "failed",
    calculation: {
      method: result.method,
      mode: result.gaussianTaskLabel || result.calculationMode,
      elapsedMs: result.elapsedMs,
    },
    provenance: result.runManifest?.provenance || null,
    files: files.map((file) => ({ path: file.path })),
  };
}
