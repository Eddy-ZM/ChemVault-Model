'use client';

import { FormEvent, useState } from 'react';

const EXAMPLES = ['Water', 'Ethanol', 'Benzene', 'Caffeine', 'Aspirin', 'Paracetamol', 'Ibuprofen', 'Glucose'];

type Props = {
  onSearch: (query: string) => Promise<void>;
  loading?: boolean;
  error?: string | null;
};

export function SearchMode({ onSearch, loading, error }: Props) {
  const [query, setQuery] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await onSearch(query);
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="max-w-3xl">
        <h2 className="text-2xl font-bold text-slate-950">Search by Name / CID</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Query PubChem by compound name or CID. Results load into the shared 3D viewer and property panel.
        </p>
      </div>

      <form onSubmit={submit} className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-w-0 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
          placeholder="caffeine, aspirin, benzene, or 2244"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-2xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Search PubChem'}
        </button>
      </form>

      {error ? <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Examples</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setQuery(example.toLowerCase());
                onSearch(example.toLowerCase());
              }}
              disabled={loading}
              className="rounded-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:border-sky-300 hover:text-sky-800 disabled:opacity-50"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
