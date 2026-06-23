'use client';

import { useEffect, useMemo, useState } from 'react';
import { normalizeSmiles } from '@/lib/chem/smiles';
import { PeriodicElement, PeriodicTablePicker } from '@/components/molecule/PeriodicTablePicker';

const DRAW_TOOLS = ['Select', 'Bond', 'Single Bond', 'Double Bond', 'Triple Bond', 'Ring', 'Aromatic Ring', 'Erase'] as const;
const RING_TEMPLATES = [
  { label: 'Benzene', value: 'c1ccccc1' },
  { label: 'Cyclohexane', value: 'C1CCCCC1' },
  { label: 'Cyclopentane', value: 'C1CCCC1' }
];
const FUNCTIONAL_GROUPS = ['OH', 'NH2', 'COOH', 'CHO', 'NO2'];

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  onGenerate3D: (value: string) => Promise<void>;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onExportSmiles: () => void;
  loading?: boolean;
  error?: string | null;
};

export function DrawMode({ value, onValueChange, onGenerate3D, onUndo, onRedo, onClear, onExportSmiles, loading, error }: Props) {
  const [activeTool, setActiveTool] = useState<(typeof DRAW_TOOLS)[number]>('Select');
  const [activeElement, setActiveElement] = useState('C');
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const toolbarGroups = useMemo(
    () => [
      DRAW_TOOLS.map((tool) => ({ label: tool, value: tool })),
      [
        { label: 'Undo', value: 'Undo' },
        { label: 'Redo', value: 'Redo' },
        { label: 'Clear', value: 'Clear' }
      ]
    ],
    []
  );

  const updateDraft = (next: string) => {
    setDraft(next);
    onValueChange(next);
  };

  const appendFragment = (fragment: string) => {
    updateDraft(normalizeSmiles(`${draft}${fragment}`));
  };

  const handleToolbarAction = (value: string) => {
    if (value === 'Undo') {
      onUndo();
      return;
    }
    if (value === 'Redo') {
      onRedo();
      return;
    }
    if (value === 'Clear') {
      updateDraft('');
      onClear();
      return;
    }
    setActiveTool(value as (typeof DRAW_TOOLS)[number]);
  };

  const handleSelectElement = (element: PeriodicElement) => {
    setActiveElement(element.symbol);
    appendFragment(element.symbol);
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-card">
      <div className="max-w-3xl">
        <h2 className="text-2xl font-bold text-slate-950">Draw Molecule</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Use the drawing workspace as a structured entry point. A full production sketcher can be connected here later without changing the workflow.
        </p>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[280px_1fr]">
        <aside className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">Drawing Toolbar</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {toolbarGroups.flat().map((tool) => (
                <button
                  key={tool.value}
                  type="button"
                  onClick={() => handleToolbarAction(tool.value)}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                    activeTool === tool.value ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-sky-300'
                  }`}
                >
                  {tool.label}
                </button>
              ))}
            </div>
          </div>

          <PeriodicTablePicker activeElement={activeElement} onSelectElement={handleSelectElement} />
        </aside>

        <div className="space-y-4">
          <div className="flex min-h-[500px] flex-col rounded-3xl border border-dashed border-slate-300 bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.12)_1px,transparent_0)] bg-[length:28px_28px] p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Sketcher workspace</p>
                <p className="text-xs text-slate-500">2D molecular sketcher is being prepared. You can still build via SMILES fragments below.</p>
              </div>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">Active: {activeTool} / {activeElement}</span>
            </div>

            <textarea
              value={draft}
              onChange={(event) => updateDraft(event.target.value)}
              className="mt-auto min-h-40 w-full rounded-2xl border border-slate-300 bg-white/95 p-4 font-mono text-sm leading-6 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
              placeholder="Build or paste sketcher SMILES here while the visual sketcher is integrated."
              spellCheck={false}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-slate-800">Ring templates</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {RING_TEMPLATES.map((template) => (
                  <button
                    key={template.label}
                    type="button"
                    onClick={() => updateDraft(template.value)}
                    className="rounded-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:border-sky-300"
                  >
                    {template.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-800">Functional groups</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {FUNCTIONAL_GROUPS.map((group) => (
                  <button
                    key={group}
                    type="button"
                    onClick={() => appendFragment(group)}
                    className="rounded-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:border-sky-300"
                  >
                    {group}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onGenerate3D(draft)}
              disabled={loading}
              className="rounded-2xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Generate 3D Model'}
            </button>
            <button
              type="button"
              onClick={onExportSmiles}
              disabled={!draft.trim()}
              className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Export SMILES
            </button>
            <button
              type="button"
              onClick={() => {
                updateDraft('');
                onClear();
              }}
              className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Clear Drawing
            </button>
          </div>

          {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}
