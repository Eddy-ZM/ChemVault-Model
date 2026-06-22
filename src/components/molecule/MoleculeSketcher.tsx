'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { normalizeSmiles } from '@/lib/chem/smiles';

type Props = {
  smiles: string;
  onChange: (value: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  loading?: boolean;
};

const atomTemplates = ['C', 'H', 'O', 'N', 'S', 'P', 'F', 'Cl', 'Br', 'I'];
const functionalGroups = ['OH', 'NH2', 'COOH', 'CHO', 'NO2'];
const ringTemplates = [
  { label: 'Benzene', value: 'c1ccccc1' },
  { label: 'Cyclohexane', value: 'C1CCCCC1' },
  { label: 'Cyclopentane', value: 'C1CCCC1' }
];

export function MoleculeSketcher({ smiles, onChange, onUndo, onRedo, onClear, loading }: Props) {
  const [smilesInput, setSmilesInput] = useState(smiles);

  useEffect(() => {
    setSmilesInput(smiles);
  }, [smiles]);

  const quickSmilesActions = useMemo(
    () => [
      ...atomTemplates.map((symbol) => ({ type: 'atom' as const, symbol })),
      ...ringTemplates.map((entry) => ({ type: 'ring' as const, symbol: entry.value, label: entry.label })),
      ...functionalGroups.map((group) => ({ type: 'fragment' as const, symbol: group }))
    ],
    []
  );

  const appendToSmiles = (fragment: string) => {
    const next = normalizeSmiles(`${smilesInput}${fragment}`);
    setSmilesInput(next);
    onChange(next);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    onChange(normalizeSmiles(smilesInput));
  };

  const onInput = (value: string) => {
    setSmilesInput(value);
    onChange(value);
  };

  return (
    <div className="space-y-4" aria-label="2D molecule editor">
      <h2 className="text-lg font-semibold">2D Sketch Area</h2>
      <p className="text-sm text-slate-600">
        Quick template controls help you build a base structure. Use full control by editing the
        SMILES string directly.
      </p>
      <form onSubmit={onSubmit} className="space-y-2">
        <label htmlFor="smiles-editor" className="sr-only">
          Molecule SMILES
        </label>
        <textarea
          id="smiles-editor"
          value={smilesInput}
          onChange={(event) => onInput(event.target.value)}
          rows={4}
          className="w-full rounded-lg border border-slate-300 p-3 font-mono text-sm"
          placeholder="Type or generate SMILES…"
          spellCheck={false}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="rounded-md bg-chemvault-accent px-4 py-2 text-sm text-white"
          >
            Set SMILES
          </button>
          <button
            type="button"
            onClick={() => onInput('')}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm"
          >
            Reset SMILES
          </button>
        </div>
      </form>

      <div>
        <p className="text-sm font-semibold text-slate-700">Atoms / rings / fragments</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {quickSmilesActions.map((entry) => (
            <button
              key={`${entry.type}-${entry.symbol}`}
              type="button"
              onClick={() => appendToSmiles(entry.symbol)}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm"
              disabled={loading}
            >
              {entry.type === 'ring' ? `Insert ${entry.label}` : entry.symbol}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={onUndo} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          Undo
        </button>
        <button type="button" onClick={onRedo} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          Redo
        </button>
        <button type="button" onClick={onClear} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          Clear
        </button>
      </div>
    </div>
  );
}
