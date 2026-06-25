'use client';

import { useMemo, useState } from 'react';

export type PeriodicElement = {
  atomicNumber: number;
  symbol: string;
  name: string;
  group: number;
  period: number;
  category:
    | 'nonmetal'
    | 'noble-gas'
    | 'alkali-metal'
    | 'alkaline-earth'
    | 'metalloid'
    | 'halogen'
    | 'transition-metal'
    | 'post-transition-metal'
    | 'lanthanide'
    | 'actinide'
    | 'unknown';
  gridColumn?: number;
  gridRow?: number;
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
  { atomicNumber: 37, symbol: 'Rb', name: 'Rubidium', group: 1, period: 5, category: 'alkali-metal' },
  { atomicNumber: 38, symbol: 'Sr', name: 'Strontium', group: 2, period: 5, category: 'alkaline-earth' },
  { atomicNumber: 39, symbol: 'Y', name: 'Yttrium', group: 3, period: 5, category: 'transition-metal' },
  { atomicNumber: 40, symbol: 'Zr', name: 'Zirconium', group: 4, period: 5, category: 'transition-metal' },
  { atomicNumber: 41, symbol: 'Nb', name: 'Niobium', group: 5, period: 5, category: 'transition-metal' },
  { atomicNumber: 42, symbol: 'Mo', name: 'Molybdenum', group: 6, period: 5, category: 'transition-metal' },
  { atomicNumber: 43, symbol: 'Tc', name: 'Technetium', group: 7, period: 5, category: 'transition-metal' },
  { atomicNumber: 44, symbol: 'Ru', name: 'Ruthenium', group: 8, period: 5, category: 'transition-metal' },
  { atomicNumber: 45, symbol: 'Rh', name: 'Rhodium', group: 9, period: 5, category: 'transition-metal' },
  { atomicNumber: 46, symbol: 'Pd', name: 'Palladium', group: 10, period: 5, category: 'transition-metal' },
  { atomicNumber: 47, symbol: 'Ag', name: 'Silver', group: 11, period: 5, category: 'transition-metal' },
  { atomicNumber: 48, symbol: 'Cd', name: 'Cadmium', group: 12, period: 5, category: 'transition-metal' },
  { atomicNumber: 49, symbol: 'In', name: 'Indium', group: 13, period: 5, category: 'post-transition-metal' },
  { atomicNumber: 50, symbol: 'Sn', name: 'Tin', group: 14, period: 5, category: 'post-transition-metal' },
  { atomicNumber: 51, symbol: 'Sb', name: 'Antimony', group: 15, period: 5, category: 'metalloid' },
  { atomicNumber: 52, symbol: 'Te', name: 'Tellurium', group: 16, period: 5, category: 'metalloid' },
  { atomicNumber: 53, symbol: 'I', name: 'Iodine', group: 17, period: 5, category: 'halogen' },
  { atomicNumber: 54, symbol: 'Xe', name: 'Xenon', group: 18, period: 5, category: 'noble-gas' },
  { atomicNumber: 55, symbol: 'Cs', name: 'Caesium', group: 1, period: 6, category: 'alkali-metal' },
  { atomicNumber: 56, symbol: 'Ba', name: 'Barium', group: 2, period: 6, category: 'alkaline-earth' },
  { atomicNumber: 57, symbol: 'La', name: 'Lanthanum', group: 3, period: 6, category: 'lanthanide', gridColumn: 4, gridRow: 8 },
  { atomicNumber: 58, symbol: 'Ce', name: 'Cerium', group: 4, period: 6, category: 'lanthanide', gridColumn: 5, gridRow: 8 },
  { atomicNumber: 59, symbol: 'Pr', name: 'Praseodymium', group: 5, period: 6, category: 'lanthanide', gridColumn: 6, gridRow: 8 },
  { atomicNumber: 60, symbol: 'Nd', name: 'Neodymium', group: 6, period: 6, category: 'lanthanide', gridColumn: 7, gridRow: 8 },
  { atomicNumber: 61, symbol: 'Pm', name: 'Promethium', group: 7, period: 6, category: 'lanthanide', gridColumn: 8, gridRow: 8 },
  { atomicNumber: 62, symbol: 'Sm', name: 'Samarium', group: 8, period: 6, category: 'lanthanide', gridColumn: 9, gridRow: 8 },
  { atomicNumber: 63, symbol: 'Eu', name: 'Europium', group: 9, period: 6, category: 'lanthanide', gridColumn: 10, gridRow: 8 },
  { atomicNumber: 64, symbol: 'Gd', name: 'Gadolinium', group: 10, period: 6, category: 'lanthanide', gridColumn: 11, gridRow: 8 },
  { atomicNumber: 65, symbol: 'Tb', name: 'Terbium', group: 11, period: 6, category: 'lanthanide', gridColumn: 12, gridRow: 8 },
  { atomicNumber: 66, symbol: 'Dy', name: 'Dysprosium', group: 12, period: 6, category: 'lanthanide', gridColumn: 13, gridRow: 8 },
  { atomicNumber: 67, symbol: 'Ho', name: 'Holmium', group: 13, period: 6, category: 'lanthanide', gridColumn: 14, gridRow: 8 },
  { atomicNumber: 68, symbol: 'Er', name: 'Erbium', group: 14, period: 6, category: 'lanthanide', gridColumn: 15, gridRow: 8 },
  { atomicNumber: 69, symbol: 'Tm', name: 'Thulium', group: 15, period: 6, category: 'lanthanide', gridColumn: 16, gridRow: 8 },
  { atomicNumber: 70, symbol: 'Yb', name: 'Ytterbium', group: 16, period: 6, category: 'lanthanide', gridColumn: 17, gridRow: 8 },
  { atomicNumber: 71, symbol: 'Lu', name: 'Lutetium', group: 17, period: 6, category: 'lanthanide', gridColumn: 18, gridRow: 8 },
  { atomicNumber: 72, symbol: 'Hf', name: 'Hafnium', group: 4, period: 6, category: 'transition-metal' },
  { atomicNumber: 73, symbol: 'Ta', name: 'Tantalum', group: 5, period: 6, category: 'transition-metal' },
  { atomicNumber: 74, symbol: 'W', name: 'Tungsten', group: 6, period: 6, category: 'transition-metal' },
  { atomicNumber: 75, symbol: 'Re', name: 'Rhenium', group: 7, period: 6, category: 'transition-metal' },
  { atomicNumber: 76, symbol: 'Os', name: 'Osmium', group: 8, period: 6, category: 'transition-metal' },
  { atomicNumber: 77, symbol: 'Ir', name: 'Iridium', group: 9, period: 6, category: 'transition-metal' },
  { atomicNumber: 78, symbol: 'Pt', name: 'Platinum', group: 10, period: 6, category: 'transition-metal' },
  { atomicNumber: 79, symbol: 'Au', name: 'Gold', group: 11, period: 6, category: 'transition-metal' },
  { atomicNumber: 80, symbol: 'Hg', name: 'Mercury', group: 12, period: 6, category: 'transition-metal' },
  { atomicNumber: 81, symbol: 'Tl', name: 'Thallium', group: 13, period: 6, category: 'post-transition-metal' },
  { atomicNumber: 82, symbol: 'Pb', name: 'Lead', group: 14, period: 6, category: 'post-transition-metal' },
  { atomicNumber: 83, symbol: 'Bi', name: 'Bismuth', group: 15, period: 6, category: 'post-transition-metal' },
  { atomicNumber: 84, symbol: 'Po', name: 'Polonium', group: 16, period: 6, category: 'metalloid' },
  { atomicNumber: 85, symbol: 'At', name: 'Astatine', group: 17, period: 6, category: 'halogen' },
  { atomicNumber: 86, symbol: 'Rn', name: 'Radon', group: 18, period: 6, category: 'noble-gas' },
  { atomicNumber: 87, symbol: 'Fr', name: 'Francium', group: 1, period: 7, category: 'alkali-metal' },
  { atomicNumber: 88, symbol: 'Ra', name: 'Radium', group: 2, period: 7, category: 'alkaline-earth' },
  { atomicNumber: 89, symbol: 'Ac', name: 'Actinium', group: 3, period: 7, category: 'actinide', gridColumn: 4, gridRow: 9 },
  { atomicNumber: 90, symbol: 'Th', name: 'Thorium', group: 4, period: 7, category: 'actinide', gridColumn: 5, gridRow: 9 },
  { atomicNumber: 91, symbol: 'Pa', name: 'Protactinium', group: 5, period: 7, category: 'actinide', gridColumn: 6, gridRow: 9 },
  { atomicNumber: 92, symbol: 'U', name: 'Uranium', group: 6, period: 7, category: 'actinide', gridColumn: 7, gridRow: 9 },
  { atomicNumber: 93, symbol: 'Np', name: 'Neptunium', group: 7, period: 7, category: 'actinide', gridColumn: 8, gridRow: 9 },
  { atomicNumber: 94, symbol: 'Pu', name: 'Plutonium', group: 8, period: 7, category: 'actinide', gridColumn: 9, gridRow: 9 },
  { atomicNumber: 95, symbol: 'Am', name: 'Americium', group: 9, period: 7, category: 'actinide', gridColumn: 10, gridRow: 9 },
  { atomicNumber: 96, symbol: 'Cm', name: 'Curium', group: 10, period: 7, category: 'actinide', gridColumn: 11, gridRow: 9 },
  { atomicNumber: 97, symbol: 'Bk', name: 'Berkelium', group: 11, period: 7, category: 'actinide', gridColumn: 12, gridRow: 9 },
  { atomicNumber: 98, symbol: 'Cf', name: 'Californium', group: 12, period: 7, category: 'actinide', gridColumn: 13, gridRow: 9 },
  { atomicNumber: 99, symbol: 'Es', name: 'Einsteinium', group: 13, period: 7, category: 'actinide', gridColumn: 14, gridRow: 9 },
  { atomicNumber: 100, symbol: 'Fm', name: 'Fermium', group: 14, period: 7, category: 'actinide', gridColumn: 15, gridRow: 9 },
  { atomicNumber: 101, symbol: 'Md', name: 'Mendelevium', group: 15, period: 7, category: 'actinide', gridColumn: 16, gridRow: 9 },
  { atomicNumber: 102, symbol: 'No', name: 'Nobelium', group: 16, period: 7, category: 'actinide', gridColumn: 17, gridRow: 9 },
  { atomicNumber: 103, symbol: 'Lr', name: 'Lawrencium', group: 17, period: 7, category: 'actinide', gridColumn: 18, gridRow: 9 },
  { atomicNumber: 104, symbol: 'Rf', name: 'Rutherfordium', group: 4, period: 7, category: 'transition-metal' },
  { atomicNumber: 105, symbol: 'Db', name: 'Dubnium', group: 5, period: 7, category: 'transition-metal' },
  { atomicNumber: 106, symbol: 'Sg', name: 'Seaborgium', group: 6, period: 7, category: 'transition-metal' },
  { atomicNumber: 107, symbol: 'Bh', name: 'Bohrium', group: 7, period: 7, category: 'transition-metal' },
  { atomicNumber: 108, symbol: 'Hs', name: 'Hassium', group: 8, period: 7, category: 'transition-metal' },
  { atomicNumber: 109, symbol: 'Mt', name: 'Meitnerium', group: 9, period: 7, category: 'unknown' },
  { atomicNumber: 110, symbol: 'Ds', name: 'Darmstadtium', group: 10, period: 7, category: 'unknown' },
  { atomicNumber: 111, symbol: 'Rg', name: 'Roentgenium', group: 11, period: 7, category: 'unknown' },
  { atomicNumber: 112, symbol: 'Cn', name: 'Copernicium', group: 12, period: 7, category: 'transition-metal' },
  { atomicNumber: 113, symbol: 'Nh', name: 'Nihonium', group: 13, period: 7, category: 'unknown' },
  { atomicNumber: 114, symbol: 'Fl', name: 'Flerovium', group: 14, period: 7, category: 'post-transition-metal' },
  { atomicNumber: 115, symbol: 'Mc', name: 'Moscovium', group: 15, period: 7, category: 'unknown' },
  { atomicNumber: 116, symbol: 'Lv', name: 'Livermorium', group: 16, period: 7, category: 'unknown' },
  { atomicNumber: 117, symbol: 'Ts', name: 'Tennessine', group: 17, period: 7, category: 'halogen' },
  { atomicNumber: 118, symbol: 'Og', name: 'Oganesson', group: 18, period: 7, category: 'noble-gas' }
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
  'post-transition-metal': 'border-indigo-200 bg-indigo-50 text-indigo-900',
  lanthanide: 'border-lime-200 bg-lime-50 text-lime-900',
  actinide: 'border-rose-200 bg-rose-50 text-rose-900',
  unknown: 'border-zinc-300 bg-zinc-50 text-zinc-800'
};

type Props = {
  activeElement: string;
  onSelectElement: (element: PeriodicElement) => void;
  onLockElement?: (element: PeriodicElement) => void;
};

export function PeriodicTablePicker({ activeElement, onSelectElement, onLockElement }: Props) {
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
      (element) => element.symbol.toLowerCase().includes(normalized) ||
        element.name.toLowerCase().includes(normalized) ||
        element.atomicNumber.toString().includes(normalized)
    );
  }, [query]);

  const isFiltering = query.trim().length > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">Element Picker</p>
          <p className="text-xs text-slate-500">
            Active element: <span className="font-mono font-semibold text-slate-950">{activeElement}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:border-sky-300"
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
            onClick={() => onSelectElement(element)}
            onDoubleClick={() => onLockElement?.(element)}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
              activeElement === element.symbol ? 'border-slate-950 bg-slate-950 text-white' : categoryClasses[element.category]
            }`}
          >
            {element.symbol}
          </button>
        ))}
      </div>

      {open ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-3" role="dialog" aria-modal="true">
          <div className="max-h-[94vh] w-full max-w-[1500px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-2xl font-bold text-slate-950">Periodic Table</h3>
                <p className="mt-1 text-sm text-slate-600">Complete 118-element picker. Search by symbol, name, or atomic number.</p>
                <p className="mt-2 text-sm text-slate-700">
                  Active element: <span className="font-mono font-semibold">{activeElement}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
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
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
              placeholder="Carbon, C, Oxygen, O, 6"
            />

            <div
              className={
                isFiltering
                  ? 'mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9'
                  : 'mt-4 grid grid-cols-[repeat(18,minmax(0,1fr))] gap-1'
              }
            >
              {filteredElements.map((element) => {
                const selected = activeElement === element.symbol;
                const position = isFiltering
                  ? undefined
                  : {
                      gridColumn: element.gridColumn ?? element.group,
                      gridRow: element.gridRow ?? element.period
                    };

                return (
                  <button
                    key={`${element.atomicNumber}-${element.symbol}`}
                    type="button"
                    title={`${element.name} (${element.atomicNumber})`}
                    onClick={() => onSelectElement(element)}
            onDoubleClick={() => onLockElement?.(element)}
                    style={position}
                    className={`min-h-12 rounded-md border p-1.5 text-left transition hover:-translate-y-0.5 ${
                      selected ? 'border-slate-950 bg-slate-950 text-white shadow-card' : categoryClasses[element.category]
                    }`}
                  >
                    <span className="block text-[9px] leading-none opacity-70">{element.atomicNumber}</span>
                    <span className="block text-sm font-bold leading-tight md:text-base">{element.symbol}</span>
                    <span className="mt-0.5 hidden truncate text-[9px] opacity-80 md:block">{element.name}</span>
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
