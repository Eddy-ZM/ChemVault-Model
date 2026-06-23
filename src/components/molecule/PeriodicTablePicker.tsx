'use client';

import { useMemo, useState } from 'react';

export type PeriodicElement = {
  atomicNumber: number;
  symbol: string;
  name: string;
  group: number;
  period: number;
  category: 'nonmetal' | 'noble-gas' | 'alkali-metal' | 'alkaline-earth' | 'metalloid' | 'halogen' | 'transition-metal' | 'post-transition-metal';
};

export const ELEMENTS: PeriodicElement[] = [
  { atomicNumber: 1, symbol: 'H', name: 'Hydrogen', group: 1, period: 1, category: 'nonmetal' },
  { atomicNumber: 2, symbol: 'He', name: 'Helium', group: 18, period: 1, category: 'noble-gas' },
  { atomicNumber: 3, symbol: 'Li', name: 'Lithium', group: 1, period: 2, category: 'alkali-metal' },
  { atomicNumber: 4, symbol: 'Be', name: 'Beryllium', group: 2, period: 2, category: 'alkaline-earth' },
  { atomicNumber: 5, symbol: 'B', name: 'Boron', group: 13, period: 2, category: 'metalloid' },
  { atomicNumber: 6, symbol: 'C', name: 'Carbon', group: 14, period: 2, category: 'nonmetal' },
  { atomicNumber: 7, symbol: 'N', name: 'Nitrogen', group: 15, period: 2, category: 'nonmetal' },
  { atomicNumber: 8, symbol: 'O', name: 'Oxygen', group: 16, period: 2, category: 'nonmetal' },
  { atomicNumber: 9, symbol: 'F', name: 'Fluorine', group: 17, period: 2, category: 'halogen' },
  { atomicNumber: 10, symbol: 'Ne', name: 'Neon', group: 18, period: 2, category: 'noble-gas' },
  { atomicNumber: 11, symbol: 'Na', name: 'Sodium', group: 1, period: 3, category: 'alkali-metal' },
  { atomicNumber: 12, symbol: 'Mg', name: 'Magnesium', group: 2, period: 3, category: 'alkaline-earth' },
  { atomicNumber: 13, symbol: 'Al', name: 'Aluminium', group: 13, period: 3, category: 'post-transition-metal' },
  { atomicNumber: 14, symbol: 'Si', name: 'Silicon', group: 14, period: 3, category: 'metalloid' },
  { atomicNumber: 15, symbol: 'P', name: 'Phosphorus', group: 15, period: 3, category: 'nonmetal' },
  { atomicNumber: 16, symbol: 'S', name: 'Sulfur', group: 16, period: 3, category: 'nonmetal' },
  { atomicNumber: 17, symbol: 'Cl', name: 'Chlorine', group: 17, period: 3, category: 'halogen' },
  { atomicNumber: 18, symbol: 'Ar', name: 'Argon', group: 18, period: 3, category: 'noble-gas' },
  { atomicNumber: 19, symbol: 'K', name: 'Potassium', group: 1, period: 4, category: 'alkali-metal' },
  { atomicNumber: 20, symbol: 'Ca', name: 'Calcium', group: 2, period: 4, category: 'alkaline-earth' },
  { atomicNumber: 21, symbol: 'Sc', name: 'Scandium', group: 3, period: 4, category: 'transition-metal' },
  { atomicNumber: 22, symbol: 'Ti', name: 'Titanium', group: 4, period: 4, category: 'transition-metal' },
  { atomicNumber: 23, symbol: 'V', name: 'Vanadium', group: 5, period: 4, category: 'transition-metal' },
  { atomicNumber: 24, symbol: 'Cr', name: 'Chromium', group: 6, period: 4, category: 'transition-metal' },
  { atomicNumber: 25, symbol: 'Mn', name: 'Manganese', group: 7, period: 4, category: 'transition-metal' },
  { atomicNumber: 26, symbol: 'Fe', name: 'Iron', group: 8, period: 4, category: 'transition-metal' },
  { atomicNumber: 27, symbol: 'Co', name: 'Cobalt', group: 9, period: 4, category: 'transition-metal' },
  { atomicNumber: 28, symbol: 'Ni', name: 'Nickel', group: 10, period: 4, category: 'transition-metal' },
  { atomicNumber: 29, symbol: 'Cu', name: 'Copper', group: 11, period: 4, category: 'transition-metal' },
  { atomicNumber: 30, symbol: 'Zn', name: 'Zinc', group: 12, period: 4, category: 'transition-metal' },
  { atomicNumber: 31, symbol: 'Ga', name: 'Gallium', group: 13, period: 4, category: 'post-transition-metal' },
  { atomicNumber: 32, symbol: 'Ge', name: 'Germanium', group: 14, period: 4, category: 'metalloid' },
  { atomicNumber: 33, symbol: 'As', name: 'Arsenic', group: 15, period: 4, category: 'metalloid' },
  { atomicNumber: 34, symbol: 'Se', name: 'Selenium', group: 16, period: 4, category: 'nonmetal' },
  { atomicNumber: 35, symbol: 'Br', name: 'Bromine', group: 17, period: 4, category: 'halogen' },
  { atomicNumber: 36, symbol: 'Kr', name: 'Krypton', group: 18, period: 4, category: 'noble-gas' },
  { atomicNumber: 53, symbol: 'I', name: 'Iodine', group: 17, period: 5, category: 'halogen' }
];

const COMMON_SYMBOLS = ['H', 'C', 'N', 'O', 'F', 'P', 'S', 'Cl', 'Br', 'I', 'B', 'Si', 'Na', 'K', 'Mg', 'Ca', 'Fe', 'Zn', 'Cu'];

const categoryClasses: Record<PeriodicElement['category'], string> = {
  nonmetal: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  'noble-gas': 'border-violet-200 bg-violet-50 text-violet-900',
  'alkali-metal': 'border-amber-200 bg-amber-50 text-amber-900',
  'alkaline-earth': 'border-orange-200 bg-orange-50 text-orange-900',
  metalloid: 'border-cyan-200 bg-cyan-50 text-cyan-900',
  halogen: 'border-sky-200 bg-sky-50 text-sky-900',
  'transition-metal': 'border-slate-300 bg-slate-50 text-slate-900',
  'post-transition-metal': 'border-indigo-200 bg-indigo-50 text-indigo-900'
};

type Props = {
  activeElement: string;
  onSelectElement: (element: PeriodicElement) => void;
};

export function PeriodicTablePicker({ activeElement, onSelectElement }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const commonElements = useMemo(
    () => COMMON_SYMBOLS.map((symbol) => ELEMENTS.find((element) => element.symbol === symbol)).filter(Boolean) as PeriodicElement[],
    []
  );

  const filteredElements = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return ELEMENTS;
    return ELEMENTS.filter(
      (element) => element.symbol.toLowerCase().includes(normalized) || element.name.toLowerCase().includes(normalized)
    );
  }, [query]);

  const selectElement = (element: PeriodicElement) => {
    onSelectElement(element);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">Element Picker</p>
          <p className="text-xs text-slate-500">Active element: <span className="font-mono font-semibold text-slate-950">{activeElement}</span></p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:border-sky-300 hover:text-sky-800"
        >
          Open Periodic Table
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {commonElements.map((element) => (
          <button
            key={element.symbol}
            type="button"
            title={`${element.name} (${element.atomicNumber})`}
            onClick={() => selectElement(element)}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
              activeElement === element.symbol ? 'border-slate-950 bg-slate-950 text-white' : categoryClasses[element.category]
            }`}
          >
            {element.symbol}
          </button>
        ))}
      </div>

      {open ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/55 px-4 py-8" role="dialog" aria-modal="true">
          <div className="max-h-[88vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-white/40 bg-white p-5 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-2xl font-bold text-slate-950">Periodic Table</h3>
                <p className="mt-1 text-sm text-slate-600">Search by symbol or name, then select the active drawing element.</p>
                <p className="mt-2 text-sm text-slate-700">Active element: <span className="font-mono font-semibold">{activeElement}</span></p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="element-search">
              Search element
            </label>
            <input
              id="element-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
              placeholder="Carbon, C, Oxygen, O"
            />

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9">
              {filteredElements.map((element) => {
                const selected = activeElement === element.symbol;
                return (
                  <button
                    key={`${element.atomicNumber}-${element.symbol}`}
                    type="button"
                    title={`${element.name} (${element.atomicNumber})`}
                    onClick={() => selectElement(element)}
                    className={`rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 ${
                      selected ? 'border-slate-950 bg-slate-950 text-white shadow-card' : categoryClasses[element.category]
                    }`}
                  >
                    <span className="block text-xs opacity-70">{element.atomicNumber}</span>
                    <span className="block text-xl font-bold">{element.symbol}</span>
                    <span className="mt-1 block truncate text-xs opacity-80">{element.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
