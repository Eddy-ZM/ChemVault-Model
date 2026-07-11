'use client';

import type { QuantumCalculationResult } from '@/lib/chem/quantumTypes';
import type { QuantumHistoryEntry } from '@/lib/chem/quantumWorkflow';

export function QuantumHistoryPanel({
  entries,
  onApply,
  onOpenChange,
  open
}: {
  entries: QuantumHistoryEntry[];
  onApply: (entry: QuantumHistoryEntry) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <details
      className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3"
      open={open}
      onToggle={(event) => onOpenChange(event.currentTarget.open)}
    >
      <summary className="cursor-pointer text-sm font-semibold text-slate-800">
        Local calculation history {entries.length ? `(${entries.length})` : ''}
      </summary>
      <div className="mt-3 grid gap-2">
        {entries.length ? entries.slice(0, 6).map((entry) => (
          <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-950">{entry.moleculeName}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {entry.engineLabel} / {entry.mode} / {formatHistoryDate(entry.createdAt)}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{entry.diagnosisTitle}</p>
              </div>
              <button
                type="button"
                onClick={() => onApply(entry)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Use settings
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-600">
              <span className="rounded-full bg-white px-2 py-1">{entry.status}</span>
              {typeof entry.completenessScore === 'number' ? <span className="rounded-full bg-white px-2 py-1">Completeness {entry.completenessScore}/100</span> : null}
              <span className="rounded-full bg-white px-2 py-1">{entry.method}</span>
              <span className="rounded-full bg-white px-2 py-1">{entry.atomCount} atoms</span>
              <span className="rounded-full bg-white px-2 py-1">
                Energy {entry.energyHartree === null ? 'N/A' : `${formatNumber(entry.energyHartree)} Eh`}
              </span>
            </div>
          </div>
        )) : (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
            No local calculations have been saved yet. Completed runs will appear here and in My Molecules.
          </p>
        )}
      </div>
    </details>
  );
}

export function ResultComparisonPanel({
  currentResult,
  entries
}: {
  currentResult: QuantumCalculationResult | null;
  entries: QuantumHistoryEntry[];
}) {
  const rows = [
    ...(currentResult ? [{
      id: 'current',
      label: 'Current result',
      engineLabel: currentResult.engineLabel,
      mode: currentResult.gaussianTaskLabel || currentResult.calculationMode,
      energyHartree: currentResult.energyHartree,
      dipoleDebye: currentResult.dipoleDebye?.total ?? null,
      completenessScore: undefined as number | undefined,
      status: currentResult.ok ? 'completed' : 'failed',
      createdAt: new Date().toISOString()
    }] : []),
    ...entries.slice(0, 5).map((entry) => ({
      id: entry.id,
      label: entry.moleculeName,
      engineLabel: entry.engineLabel,
      mode: entry.mode,
      energyHartree: entry.energyHartree,
      dipoleDebye: entry.dipoleDebye,
      completenessScore: entry.completenessScore,
      status: entry.status,
      createdAt: entry.createdAt
    }))
  ];

  return (
    <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <summary className="cursor-pointer text-sm font-semibold text-slate-800">
        Result comparison {rows.length ? `(${rows.length})` : ''}
      </summary>
      {rows.length ? (
        <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <div className="grid min-w-[760px] grid-cols-[minmax(140px,1.3fr)_minmax(90px,0.7fr)_minmax(94px,0.7fr)_minmax(112px,0.8fr)_minmax(98px,0.7fr)_minmax(80px,0.5fr)] bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
            <span>Run</span><span>Engine</span><span>Mode</span><span>Energy</span><span>Dipole</span><span>Completeness</span>
          </div>
          {rows.map((row) => (
            <div key={row.id} className="grid min-w-[760px] grid-cols-[minmax(140px,1.3fr)_minmax(90px,0.7fr)_minmax(94px,0.7fr)_minmax(112px,0.8fr)_minmax(98px,0.7fr)_minmax(80px,0.5fr)] border-t border-slate-100 px-3 py-2 text-xs text-slate-700">
              <span className="min-w-0"><span className="block truncate font-semibold text-slate-950">{row.label}</span><span className="mt-0.5 block text-[10px] text-slate-500">{formatHistoryDate(row.createdAt)} / {row.status}</span></span>
              <span>{row.engineLabel}</span>
              <span className="truncate">{row.mode}</span>
              <span>{row.energyHartree === null ? 'N/A' : `${formatNumber(row.energyHartree)} Eh`}</span>
              <span>{row.dipoleDebye === null ? 'N/A' : `${formatNumber(row.dipoleDebye)} D`}</span>
              <span>{typeof row.completenessScore === 'number' ? `${row.completenessScore}/100` : row.id === 'current' ? 'Live' : 'N/A'}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-xs leading-5 text-slate-500">
          Run a calculation to compare results across engines, routes, and structures.
        </p>
      )}
    </details>
  );
}

function formatHistoryDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatNumber(value: number) {
  return Number.isFinite(value) ? value.toFixed(4) : 'N/A';
}
