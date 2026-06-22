'use client';

import { ChangeEvent } from 'react';
import { FileFormat, inferFormatFromFilename } from '@/lib/chem/fileExport';

type Props = {
  onImportSmiles: (smiles: string) => void;
  onImportText: (content: string, format: Exclude<FileFormat, 'smi' | 'smiles' | 'txt'>) => void;
  onExportMol: () => void;
  onExportSdf: () => void;
  onExportXyz: () => void;
  onExportPdb: () => void;
  onExportSmi: () => void;
  loadingExport: boolean;
};

export function ImportExportPanel({
  onImportSmiles,
  onImportText,
  onExportMol,
  onExportSdf,
  onExportXyz,
  onExportPdb,
  onExportSmi,
  loadingExport
}: Props) {
  const onFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const extension = inferFormatFromFilename(file.name);
    const text = await file.text();

    if (extension === 'smi' || extension === 'smiles' || extension === 'txt') {
      onImportSmiles(text.replace(/\s+/g, ' ').trim());
      return;
    }

    if (extension === 'sdf' || extension === 'mol' || extension === 'xyz' || extension === 'pdb' || extension === 'cif') {
      onImportText(text, extension);
      return;
    }

    onImportSmiles(text.trim());
  };

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Import & Export</h2>
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
        <label className="block text-sm text-slate-600">Import mol / sdf / xyz / pdb / cif / SMILES</label>
        <input
          type="file"
          accept=".mol,.sdf,.xyz,.pdb,.cif,.smi,.smiles,.txt"
          onChange={onFileUpload}
          className="mt-2"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onExportSmi}
          className="rounded-md border border-slate-300 px-2 py-2 text-sm"
          disabled={loadingExport}
        >
          Export SMILES
        </button>
        <button
          type="button"
          onClick={onExportMol}
          className="rounded-md border border-slate-300 px-2 py-2 text-sm"
          disabled={loadingExport}
        >
          Export Molfile
        </button>
        <button
          type="button"
          onClick={onExportSdf}
          className="rounded-md border border-slate-300 px-2 py-2 text-sm"
          disabled={loadingExport}
        >
          Export SDF
        </button>
        <button
          type="button"
          onClick={onExportXyz}
          className="rounded-md border border-slate-300 px-2 py-2 text-sm"
          disabled={loadingExport}
        >
          Export XYZ
        </button>
        <button
          type="button"
          onClick={onExportPdb}
          className="rounded-md border border-slate-300 px-2 py-2 text-sm"
          disabled={loadingExport}
        >
          Export PDB
        </button>
      </div>
    </section>
  );
}
