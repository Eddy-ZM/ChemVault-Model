'use client';

import { FormEvent, useEffect, useState } from 'react';

const EXAMPLES = [
  { label: 'Ethanol', value: 'CCO' },
  { label: 'Benzene', value: 'c1ccccc1' },
  { label: 'Aspirin', value: 'CC(=O)OC1=CC=CC=C1C(=O)O' },
  { label: 'Caffeine', value: 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C' }
];

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  onLoad: (value: string) => Promise<void>;
  onClear: () => void;
  onCopy?: (value: string) => void;
  loading?: boolean;
  error?: string | null;
};

export function SmilesMode({ value, onValueChange, onLoad, onClear, onCopy, loading, error }: Props) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const updateDraft = (next: string) => {
    setDraft(next);
    onValueChange(next);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await onLoad(draft);
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="max-w-3xl">
        <h2 className="text-2xl font-bold text-slate-950">Enter SMILES</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Paste a line notation string to create or resolve a 3D molecular model. This input is separate from PubChem name search.
        </p>
      </div>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <textarea
          value={draft}
          onChange={(event) => updateDraft(event.target.value)}
          className="min-h-40 w-full rounded-3xl border border-slate-300 bg-white p-4 font-mono text-sm leading-6 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
          placeholder="Paste or type a SMILES string, e.g. CCO or c1ccccc1"
          spellCheck={false}
        />
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-2xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Loading' : 'Load SMILES'}
          </button>
          <button
            type="button"
            onClick={() => {
              updateDraft('');
              onClear();
            }}
            className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => onCopy?.(draft)}
            disabled={!draft.trim()}
            className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Copy SMILES
          </button>
        </div>
      </form>

      {error ? <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Common SMILES</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example.label}
              type="button"
              onClick={() => updateDraft(example.value)}
              className="rounded-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:border-sky-300 hover:text-sky-800"
            >
              {example.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
