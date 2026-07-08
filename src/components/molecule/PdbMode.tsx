'use client';

import { FormEvent, useState } from 'react';

const EXAMPLES = ['1CRN', '4HHB', '1BNA'];

type Props = {
  onLoadPdb: (pdbId: string) => Promise<void>;
  loading?: boolean;
  error?: string | null;
  metadata?: { pdbId?: string; title?: string | null; resolution?: number | null; experimentalMethod?: string | null };
};

export function PdbMode({ onLoadPdb, loading, error, metadata }: Props) {
  const [pdbId, setPdbId] = useState('1CRN');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await onLoadPdb(pdbId);
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="max-w-3xl">
        <h2 className="text-2xl font-bold text-slate-950">PDB Structure</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Load protein or nucleic acid structures from RCSB PDB. PDB has its own workflow separate from small molecule search.
        </p>
      </div>

      <form onSubmit={submit} className="mt-5 grid gap-3 md:grid-cols-[280px_auto]">
        <input
          value={pdbId}
          onChange={(event) => setPdbId(event.target.value.toUpperCase())}
          maxLength={4}
          className="rounded-2xl border border-slate-300 bg-white px-4 py-3 font-mono text-base uppercase outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
          placeholder="1CRN"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-2xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Loading' : 'Load PDB'}
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => {
              setPdbId(example);
              onLoadPdb(example);
            }}
            disabled={loading}
            className="rounded-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:border-sky-300 hover:text-sky-800 disabled:opacity-50"
          >
            {example}
          </button>
        ))}
      </div>

      {error ? <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

      {metadata?.pdbId ? (
        <div className="mt-5 grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-4">
          <p><span className="block text-xs text-slate-500">PDB ID</span><span className="font-semibold text-slate-950">{metadata.pdbId}</span></p>
          <p className="md:col-span-2"><span className="block text-xs text-slate-500">Title</span><span className="text-slate-800">{metadata.title || 'Not available'}</span></p>
          <p><span className="block text-xs text-slate-500">Resolution</span><span className="text-slate-800">{metadata.resolution ? `${metadata.resolution} A` : 'Not available'}</span></p>
          <p className="md:col-span-4"><span className="block text-xs text-slate-500">Experimental method</span><span className="text-slate-800">{metadata.experimentalMethod || 'Not available'}</span></p>
        </div>
      ) : null}
    </section>
  );
}
