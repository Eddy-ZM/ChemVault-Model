'use client';

import { ReactNode } from 'react';

type ExportAvailability = {
  smiles: boolean;
  structure: boolean;
  pdb: boolean;
  image: boolean;
};

export type ExportNameSource = 'auto' | 'name' | 'smiles' | 'identifier' | 'source-file' | 'custom';

const NAME_SOURCES: Array<{ value: ExportNameSource; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'name', label: 'Molecule name' },
  { value: 'smiles', label: 'SMILES' },
  { value: 'identifier', label: 'ID' },
  { value: 'source-file', label: 'Source file' },
  { value: 'custom', label: 'Custom' }
];

type Props = {
  available: ExportAvailability;
  customName: string;
  namePreview: string;
  nameSource: ExportNameSource;
  loadingExport?: boolean;
  onCustomNameChange: (value: string) => void;
  onExportSmiles: () => void;
  onExportMol: () => void;
  onExportSdf: () => void;
  onExportXyz: () => void;
  onExportPdb: () => void;
  onExportPng: () => void;
  onNameSourceChange: (value: ExportNameSource) => void;
};

export function ExportPanel({
  available,
  customName,
  namePreview,
  nameSource,
  loadingExport,
  onCustomNameChange,
  onExportSmiles,
  onExportMol,
  onExportSdf,
  onExportXyz,
  onExportPdb,
  onExportPng,
  onNameSourceChange
}: Props) {
  const hasAnything = available.smiles || available.structure || available.pdb || available.image;

  return (
    <section className="flex min-w-max flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-1 shadow-sm" aria-label="Export actions">
      <span className="hidden px-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 lg:inline">
        Export
      </span>
      <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">
        <span>Filename</span>
        <select
          value={nameSource}
          onChange={(event) => onNameSourceChange(event.target.value as ExportNameSource)}
          className="max-w-[145px] rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          title={`Current prefix: ${namePreview}`}
        >
          {NAME_SOURCES.map((source) => (
            <option key={source.value} value={source.value}>{source.label}</option>
          ))}
        </select>
      </label>
      {nameSource === 'custom' ? (
        <input
          type="text"
          value={customName}
          onChange={(event) => onCustomNameChange(event.target.value)}
          placeholder={namePreview}
          className="h-8 w-44 rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          aria-label="Custom export filename"
        />
      ) : null}
      <span
        className="hidden max-w-[180px] truncate rounded-lg bg-slate-100 px-2 py-1.5 text-xs font-medium text-slate-500 sm:inline"
        title={`Export filename prefix: ${namePreview}`}
      >
        Prefix: <span className="font-semibold text-slate-700">{namePreview}</span>
      </span>
      <div className="flex gap-1">
        <ExportButton disabled={!available.smiles || loadingExport} onClick={onExportSmiles}>SMILES</ExportButton>
        <ExportButton disabled={!available.structure || loadingExport} onClick={onExportMol}>Molfile</ExportButton>
        <ExportButton disabled={!available.structure || loadingExport} onClick={onExportSdf}>SDF</ExportButton>
        <ExportButton disabled={!available.structure || loadingExport} onClick={onExportXyz}>XYZ</ExportButton>
        <ExportButton disabled={(!available.structure && !available.pdb) || loadingExport} onClick={onExportPdb}>PDB</ExportButton>
        <ExportButton disabled={!available.image || loadingExport} onClick={onExportPng}>PNG</ExportButton>
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
