'use client';

import { useMemo } from 'react';
import { EngineSpinner } from '@/components/ui/LoadingState';

type Representation = 'ball-and-stick' | 'stick' | 'sphere' | 'line' | 'surface' | 'cartoon' | 'space-filling';

type ToolbarProps = {
  onGenerate3D: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onExportPng: () => void;
  onResetView: () => void;
  loadingGenerate3d: boolean;
  loadingExport: boolean;
  generatingDisabled: boolean;
  loadingMessage?: string;
  representation: Representation;
  background: string;
  onRepresentationChange: (value: Representation) => void;
  onBackgroundChange: (value: string) => void;
  onHydrogensToggle: () => void;
  showHydrogens: boolean;
  onLabelsToggle: () => void;
  showAtomLabels: boolean;
};

const REPRESENTATIONS: Array<{ value: Representation; label: string }> = [
  { value: 'ball-and-stick', label: 'Ball & Stick' },
  { value: 'stick', label: 'Stick' },
  { value: 'sphere', label: 'Sphere' },
  { value: 'line', label: 'Line' },
  { value: 'surface', label: 'Surface' },
  { value: 'cartoon', label: 'Cartoon' },
  { value: 'space-filling', label: 'Space-filling' }
];

export function Toolbar({
  onGenerate3D,
  onUndo,
  onRedo,
  onClear,
  onExportPng,
  onResetView,
  loadingGenerate3d,
  loadingExport,
  generatingDisabled,
  loadingMessage,
  representation,
  background,
  onRepresentationChange,
  onBackgroundChange,
  onHydrogensToggle,
  showHydrogens,
  onLabelsToggle,
  showAtomLabels
}: ToolbarProps) {
  const backgroundOptions = useMemo(
    () => [
      { value: 'white', label: 'White' },
      { value: 'black', label: 'Black' },
      { value: 'transparent', label: 'Transparent' }
    ],
    []
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onGenerate3D}
          disabled={generatingDisabled || loadingGenerate3d}
          className="rounded-lg bg-chemvault-accent px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loadingGenerate3d ? (
            <span className="inline-flex items-center justify-center gap-2">
              <EngineSpinner size="xs" decorative className="cv-engine-spinner-on-dark" />
              Generating
            </span>
          ) : (
            'Generate 3D Model'
          )}
        </button>
        <button
          type="button"
          onClick={onUndo}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={onRedo}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          Redo
        </button>
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={onExportPng}
          disabled={loadingExport}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loadingExport ? (
            <span className="inline-flex items-center justify-center gap-2">
              <EngineSpinner size="xs" decorative />
              Exporting
            </span>
          ) : (
            'Export PNG'
          )}
        </button>
        <button
          type="button"
          onClick={onResetView}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          Reset View
        </button>
      </div>
      <p className="text-xs text-slate-500">{loadingMessage || ' '}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm">
          Representation
          <select
            value={representation}
            onChange={(e) => onRepresentationChange(e.target.value as Representation)}
            className="ml-auto rounded-md border border-slate-300 bg-white px-2 py-1"
          >
            {REPRESENTATIONS.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          Background
          <select
            value={background}
            onChange={(e) => onBackgroundChange(e.target.value)}
            className="ml-auto rounded-md border border-slate-300 bg-white px-2 py-1"
          >
            {backgroundOptions.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={onHydrogensToggle}
          className={`rounded-md border px-3 py-2 text-sm ${
            showHydrogens ? 'border-chemvault-accent text-chemvault-accent' : 'border-slate-300'
          }`}
        >
          {showHydrogens ? 'Hydrogens Visible' : 'Hide Hydrogens'}
        </button>
        <button
          type="button"
          onClick={onLabelsToggle}
          className={`rounded-md border px-3 py-2 text-sm ${
            showAtomLabels ? 'border-chemvault-accent text-chemvault-accent' : 'border-slate-300'
          }`}
        >
          {showAtomLabels ? 'Hide Atom Labels' : 'Show Atom Labels'}
        </button>
      </div>
    </div>
  );
}
