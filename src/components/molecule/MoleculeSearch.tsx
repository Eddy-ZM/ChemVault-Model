'use client';

import { FormEvent, useState } from 'react';
import { EngineSpinner } from '@/components/ui/LoadingState';

type Props = {
  onSearch: (query: string) => Promise<void>;
  loading?: boolean;
};

const examples = ['caffeine', 'aspirin', 'benzene', 'ethanol', 'glucose', 'paracetamol', 'ibuprofen', 'methane', 'water'];

export function MoleculeSearch({ onSearch, loading }: Props) {
  const [query, setQuery] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    await onSearch(trimmed);
  };

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Molecule Search</h2>
      <form onSubmit={handleSubmit} className="grid gap-2 sm:flex">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Enter name, SMILES, InChI, CID"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="w-full rounded-md bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-50 sm:w-auto"
        >
          {loading ? (
            <span className="inline-flex items-center justify-center gap-2">
              <EngineSpinner size="xs" decorative className="cv-engine-spinner-on-dark" />
              Search
            </span>
          ) : (
            'Search'
          )}
        </button>
      </form>

      <p className="text-xs text-slate-500">
        Try samples: <span className="font-semibold">draw, paste SMILES, or search PubChem to begin.</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {examples.map((item) => (
          <button
            type="button"
            key={item}
            onClick={() => {
              setQuery(item);
              onSearch(item);
            }}
            disabled={loading}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs"
          >
            {item}
          </button>
        ))}
      </div>
    </section>
  );
}
