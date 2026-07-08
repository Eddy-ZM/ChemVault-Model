'use client';

import { useState } from 'react';

type Props = {
  onLoadPdb: (pdbId: string) => void;
  loading: boolean;
  metadata?: { pdbId?: string; title?: string | null; resolution?: number | null; experimentalMethod?: string | null };
};

export function PDBViewerPanel({ onLoadPdb, loading, metadata }: Props) {
  const [pdbId, setPdbId] = useState('1CRN');

  const handleLoad = () => {
    if (!pdbId.trim()) return;
    onLoadPdb(pdbId.trim());
  };

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Protein / PDB</h2>
      <div className="flex gap-2">
        <input
          value={pdbId}
          onChange={(event) => setPdbId(event.target.value.toUpperCase())}
          maxLength={4}
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2"
          placeholder="1CRN"
        />
        <button
          type="button"
          onClick={handleLoad}
          className="rounded-md bg-slate-800 px-3 py-2 text-sm text-white"
          disabled={loading}
        >
          {loading ? 'Loading' : 'Load PDB'}
        </button>
      </div>
      <p className="text-xs text-slate-500">Examples: 1CRN, 4HHB, 1BNA</p>
      {metadata?.pdbId ? (
        <div className="rounded-md border border-slate-200 p-3 text-sm">
          <p>
            <span className="text-slate-500">PDB ID:</span> {metadata.pdbId}
          </p>
          <p>
            <span className="text-slate-500">Title:</span> {metadata.title || 'N/A'}
          </p>
          <p>
            <span className="text-slate-500">Resolution:</span>{' '}
            {metadata.resolution ? `${metadata.resolution} Å` : 'N/A'}
          </p>
          <p>
            <span className="text-slate-500">Experimental:</span> {metadata.experimentalMethod || 'N/A'}
          </p>
        </div>
      ) : null}
    </section>
  );
}
