'use client';

import { ReactNode } from 'react';

type ExportAvailability = {
  smiles: boolean;
  structure: boolean;
  pdb: boolean;
};

type Props = {
  available: ExportAvailability;
  loadingExport?: boolean;
  onExportSmiles: () => void;
  onExportMol: () => void;
  onExportSdf: () => void;
  onExportXyz: () => void;
  onExportPdb: () => void;
};

export function ExportPanel({ available, loadingExport, onExportSmiles, onExportMol, onExportSdf, onExportXyz, onExportPdb }: Props) {
  const hasAnything = available.smiles || available.structure || available.pdb;

  return (
    <section className="flex min-w-max items-center gap-2 rounded-xl border border-slate-200 bg-white p-1 shadow-sm" aria-label="Export actions">
      <span className="hidden px-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 lg:inline">
        Export
      </span>
      <div className="flex gap-1">
        <ExportButton disabled={!available.smiles || loadingExport} onClick={onExportSmiles}>SMILES</ExportButton>
        <ExportButton disabled={!available.structure || loadingExport} onClick={onExportMol}>Molfile</ExportButton>
        <ExportButton disabled={!available.structure || loadingExport} onClick={onExportSdf}>SDF</ExportButton>
        <ExportButton disabled={!available.structure || loadingExport} onClick={onExportXyz}>XYZ</ExportButton>
        <ExportButton disabled={(!available.structure && !available.pdb) || loadingExport} onClick={onExportPdb}>PDB</ExportButton>
      </div>
      {!hasAnything ? <span className="sr-only">Load a molecule before exporting structure files.</span> : null}
    </section>
  );
}

function ExportButton({ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
    >
      {children}
    </button>
  );
}
