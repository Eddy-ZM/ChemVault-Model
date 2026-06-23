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
    <section className="rounded-3xl border border-slate-200 bg-white/95 p-4">
      <div>
        <h3 className="text-base font-semibold text-slate-950">Export Actions</h3>
        <p className="mt-1 text-xs text-slate-500">
          {hasAnything ? 'Export the current molecule or structure data.' : 'Load a molecule before exporting structure files.'}
        </p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <ExportButton disabled={!available.smiles || loadingExport} onClick={onExportSmiles}>SMILES</ExportButton>
        <ExportButton disabled={!available.structure || loadingExport} onClick={onExportMol}>Molfile</ExportButton>
        <ExportButton disabled={!available.structure || loadingExport} onClick={onExportSdf}>SDF</ExportButton>
        <ExportButton disabled={!available.structure || loadingExport} onClick={onExportXyz}>XYZ</ExportButton>
        <ExportButton disabled={(!available.structure && !available.pdb) || loadingExport} onClick={onExportPdb}>PDB</ExportButton>
      </div>
    </section>
  );
}

function ExportButton({ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:border-sky-300 hover:text-sky-800 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
