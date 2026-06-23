'use client';

import { MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeSmiles } from '@/lib/chem/smiles';
import { PeriodicElement, PeriodicTablePicker } from '@/components/molecule/PeriodicTablePicker';

const DRAW_TOOLS = ['Select', 'Atom', 'Single Bond', 'Double Bond', 'Triple Bond', 'Ring', 'Aromatic Ring', 'Erase'] as const;
const FUNCTIONAL_GROUPS = ['OH', 'NH2', 'COOH', 'CHO', 'NO2'];
const VIEWBOX_WIDTH = 900;
const VIEWBOX_HEIGHT = 520;
const ATOM_RADIUS = 20;

type DrawTool = (typeof DRAW_TOOLS)[number];
type BondOrder = 1 | 2 | 3 | 'aromatic';
type AtomNode = { id: string; x: number; y: number; element: string };
type BondEdge = { id: string; from: string; to: string; order: BondOrder };
type SketchState = { atoms: AtomNode[]; bonds: BondEdge[] };

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

export function DrawMode({ value, onValueChange, onGenerate3D, onClear, onExportSmiles, loading, error }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const history = useRef<SketchState[]>([{ atoms: [], bonds: [] }]);
  const redoHistory = useRef<SketchState[]>([]);
  const idCounter = useRef(0);

  const [activeTool, setActiveTool] = useState<DrawTool>('Atom');
  const [activeElement, setActiveElement] = useState('C');
  const [selectedAtomId, setSelectedAtomId] = useState<string | null>(null);
  const [pendingBondAtomId, setPendingBondAtomId] = useState<string | null>(null);
  const [atoms, setAtoms] = useState<AtomNode[]>([]);
  const [bonds, setBonds] = useState<BondEdge[]>([]);
  const [draft, setDraft] = useState(value);
  const [sketchMessage, setSketchMessage] = useState('Select an element, then click the canvas to place atoms. Select a bond tool, then click two atoms or click empty space to place a bond.');

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const selectedAtom = useMemo(() => atoms.find((atom) => atom.id === selectedAtomId) ?? null, [atoms, selectedAtomId]);

  const updateDraft = (next: string) => {
    setDraft(next);
    onValueChange(next);
  };

  const nextId = (prefix: string) => {
    idCounter.current += 1;
    return `${prefix}-${idCounter.current}`;
  };

  const commitSketch = (nextState: SketchState, message?: string) => {
    setAtoms(nextState.atoms);
    setBonds(nextState.bonds);
    history.current.push(cloneSketch(nextState));
    redoHistory.current = [];
    const nextSmiles = graphToSmiles(nextState.atoms, nextState.bonds);
    updateDraft(nextSmiles);
    if (message) setSketchMessage(message);
  };

  const undoSketch = () => {
    if (history.current.length <= 1) return;
    const current = history.current.pop();
    if (current) redoHistory.current.push(current);
    const previous = history.current[history.current.length - 1] ?? { atoms: [], bonds: [] };
    setAtoms(previous.atoms);
    setBonds(previous.bonds);
    updateDraft(graphToSmiles(previous.atoms, previous.bonds));
    setPendingBondAtomId(null);
    setSelectedAtomId(null);
  };

  const redoSketch = () => {
    const next = redoHistory.current.pop();
    if (!next) return;
    history.current.push(cloneSketch(next));
    setAtoms(next.atoms);
    setBonds(next.bonds);
    updateDraft(graphToSmiles(next.atoms, next.bonds));
    setPendingBondAtomId(null);
    setSelectedAtomId(null);
  };

  const resetSketch = () => {
    history.current = [{ atoms: [], bonds: [] }];
    redoHistory.current = [];
    setAtoms([]);
    setBonds([]);
    setSelectedAtomId(null);
    setPendingBondAtomId(null);
    updateDraft('');
    onClear();
    setSketchMessage('Sketch cleared. Click the canvas to place a new atom.');
  };

  const getCanvasPoint = (event: MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((event.clientX - rect.left) / rect.width) * VIEWBOX_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * VIEWBOX_HEIGHT
    };
  };

  const handleCanvasClick = (event: MouseEvent<SVGSVGElement>) => {
    const point = getCanvasPoint(event);
    const hitAtom = findAtomAt(atoms, point.x, point.y);
    const hitBond = findBondAt(atoms, bonds, point.x, point.y);

    if (activeTool === 'Erase') {
      if (hitAtom) {
        removeAtom(hitAtom.id);
      } else if (hitBond) {
        removeBond(hitBond.id);
      }
      return;
    }

    if (activeTool === 'Ring' || activeTool === 'Aromatic Ring') {
      addRing(point.x, point.y, activeTool === 'Aromatic Ring');
      return;
    }

    if (isBondTool(activeTool)) {
      placeBond(point.x, point.y, orderForTool(activeTool), hitAtom);
      return;
    }

    if (hitAtom) {
      setSelectedAtomId(hitAtom.id);
      setPendingBondAtomId(null);
      setSketchMessage(`Selected atom ${hitAtom.element}. Choose an element to replace it or choose a bond tool.`);
      return;
    }

    addAtom(point.x, point.y, activeElement);
  };

  const addAtom = (x: number, y: number, element: string) => {
    const atom = { id: nextId('atom'), x: clamp(x, 28, VIEWBOX_WIDTH - 28), y: clamp(y, 28, VIEWBOX_HEIGHT - 28), element };
    commitSketch({ atoms: [...atoms, atom], bonds }, `Placed ${element}.`);
    setSelectedAtomId(atom.id);
  };

  const placeBond = (x: number, y: number, order: BondOrder, hitAtom: AtomNode | null) => {
    if (hitAtom) {
      if (pendingBondAtomId && pendingBondAtomId !== hitAtom.id) {
        addBond(pendingBondAtomId, hitAtom.id, order);
        setPendingBondAtomId(null);
        setSelectedAtomId(hitAtom.id);
        return;
      }
      setPendingBondAtomId(hitAtom.id);
      setSelectedAtomId(hitAtom.id);
      setSketchMessage(`Bond start set at ${hitAtom.element}. Click another atom or empty canvas to place the bond.`);
      return;
    }

    if (pendingBondAtomId) {
      const source = atoms.find((atom) => atom.id === pendingBondAtomId);
      if (!source) return;
      const atom = { id: nextId('atom'), x: clamp(x, 28, VIEWBOX_WIDTH - 28), y: clamp(y, 28, VIEWBOX_HEIGHT - 28), element: activeElement };
      const bond = { id: nextId('bond'), from: source.id, to: atom.id, order };
      commitSketch({ atoms: [...atoms, atom], bonds: [...bonds, bond] }, `Placed ${labelForOrder(order)} bond to ${activeElement}.`);
      setPendingBondAtomId(atom.id);
      setSelectedAtomId(atom.id);
      return;
    }

    const length = 82;
    const atomA = { id: nextId('atom'), x: clamp(x - length / 2, 28, VIEWBOX_WIDTH - 28), y, element: 'C' };
    const atomB = { id: nextId('atom'), x: clamp(x + length / 2, 28, VIEWBOX_WIDTH - 28), y, element: activeElement };
    const bond = { id: nextId('bond'), from: atomA.id, to: atomB.id, order };
    commitSketch({ atoms: [...atoms, atomA, atomB], bonds: [...bonds, bond] }, `Placed ${labelForOrder(order)} bond.`);
    setPendingBondAtomId(atomB.id);
    setSelectedAtomId(atomB.id);
  };

  const addBond = (from: string, to: string, order: BondOrder) => {
    if (bonds.some((bond) => sameBond(bond, from, to))) {
      setSketchMessage('Those atoms are already bonded.');
      return;
    }
    const bond = { id: nextId('bond'), from, to, order };
    commitSketch({ atoms, bonds: [...bonds, bond] }, `Added ${labelForOrder(order)} bond.`);
  };

  const removeAtom = (atomId: string) => {
    commitSketch(
      {
        atoms: atoms.filter((atom) => atom.id !== atomId),
        bonds: bonds.filter((bond) => bond.from !== atomId && bond.to !== atomId)
      },
      'Atom removed.'
    );
    setSelectedAtomId(null);
    setPendingBondAtomId(null);
  };

  const removeBond = (bondId: string) => {
    commitSketch({ atoms, bonds: bonds.filter((bond) => bond.id !== bondId) }, 'Bond removed.');
  };

  const addRing = (x: number, y: number, aromatic: boolean) => {
    const radius = 74;
    const centerX = clamp(x, 110, VIEWBOX_WIDTH - 110);
    const centerY = clamp(y, 110, VIEWBOX_HEIGHT - 110);
    const ringAtoms: AtomNode[] = Array.from({ length: 6 }, (_, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / 6;
      return {
        id: nextId('atom'),
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        element: aromatic ? 'c' : 'C'
      };
    });
    const ringBonds: BondEdge[] = ringAtoms.map((atom, index) => ({
      id: nextId('bond'),
      from: atom.id,
      to: ringAtoms[(index + 1) % ringAtoms.length].id,
      order: aromatic ? 'aromatic' : 1
    }));

    commitSketch(
      { atoms: [...atoms, ...ringAtoms], bonds: [...bonds, ...ringBonds] },
      aromatic ? 'Placed aromatic ring.' : 'Placed cyclohexane ring.'
    );
    setSelectedAtomId(ringAtoms[0].id);
    setPendingBondAtomId(null);
  };

  const handleSelectElement = (element: PeriodicElement) => {
    setActiveElement(element.symbol);
    setActiveTool('Atom');
    if (!selectedAtomId) {
      setSketchMessage(`Active element set to ${element.symbol}. Click the canvas to place it.`);
      return;
    }
    const nextAtoms = atoms.map((atom) => (atom.id === selectedAtomId ? { ...atom, element: element.symbol } : atom));
    commitSketch({ atoms: nextAtoms, bonds }, `Selected atom changed to ${element.symbol}.`);
  };

  const appendFunctionalGroup = (group: string) => {
    const next = normalizeSmiles(`${draft}${group}`);
    updateDraft(next);
    setSketchMessage(`${group} appended to SMILES text. Complex groups are represented in text until full fragment placement is added.`);
  };

  const generatedFromSketch = graphToSmiles(atoms, bonds);
  const canUseSketchSmiles = generatedFromSketch.trim().length > 0;
  const effectiveSmiles = canUseSketchSmiles ? generatedFromSketch : draft;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="max-w-3xl">
        <h2 className="text-xl font-bold text-slate-950">Draw Molecule</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Select an element or bond type, then click the canvas to place atoms and bonds. The sketcher generates a basic SMILES for the existing 3D workflow.
        </p>
      </div>

      <div className="mt-5 grid gap-5">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="text-slate-600">
                Tool: <span className="font-semibold text-slate-950">{activeTool}</span> / Element:{' '}
                <span className="font-mono font-semibold text-slate-950">{activeElement}</span>
                {pendingBondAtomId ? <span className="ml-2 text-sky-700">Bond start selected</span> : null}
              </div>
              <div className="text-slate-500">
                {atoms.length} atoms / {bonds.length} bonds
              </div>
            </div>

            <div className="relative">
              <div className="absolute left-3 top-3 z-10 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur">
                {DRAW_TOOLS.map((tool) => (
                  <button
                    key={tool}
                    type="button"
                    title={tool}
                    aria-label={tool}
                    onClick={() => {
                      setActiveTool(tool);
                      setPendingBondAtomId(null);
                    }}
                    className={`grid h-10 w-10 place-items-center rounded-lg border text-sm font-medium transition ${
                      activeTool === tool ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-sky-300'
                    }`}
                  >
                    <ToolIcon tool={tool} activeElement={activeElement} />
                  </button>
                ))}
              </div>

              <div className="absolute right-3 top-3 z-10 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur">
                <button type="button" title="Undo" aria-label="Undo" onClick={undoSketch} className="grid h-10 w-10 place-items-center rounded-lg border border-slate-300 bg-white text-sm text-slate-700 hover:border-sky-300">
                  ↶
                </button>
                <button type="button" title="Redo" aria-label="Redo" onClick={redoSketch} className="grid h-10 w-10 place-items-center rounded-lg border border-slate-300 bg-white text-sm text-slate-700 hover:border-sky-300">
                  ↷
                </button>
                <button type="button" title="Clear" aria-label="Clear" onClick={resetSketch} className="grid h-10 w-10 place-items-center rounded-lg border border-slate-300 bg-white text-sm text-slate-700 hover:border-sky-300">
                  ×
                </button>
              </div>

              <svg
                ref={svgRef}
                viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
                onClick={handleCanvasClick}
                className="h-[500px] w-full rounded-xl border border-slate-200 bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.14)_1px,transparent_0)] bg-[length:26px_26px]"
                role="img"
                aria-label="2D molecule drawing canvas"
              >
                {bonds.map((bond) => {
                  const from = atoms.find((atom) => atom.id === bond.from);
                  const to = atoms.find((atom) => atom.id === bond.to);
                  if (!from || !to) return null;
                  return <BondLines key={bond.id} from={from} to={to} order={bond.order} />;
                })}
                {atoms.map((atom) => {
                  const selected = atom.id === selectedAtomId;
                  const pending = atom.id === pendingBondAtomId;
                  return (
                    <g key={atom.id}>
                      <circle
                        cx={atom.x}
                        cy={atom.y}
                        r={ATOM_RADIUS}
                        className={`${selected || pending ? 'fill-sky-100 stroke-sky-700' : 'fill-white stroke-slate-700'}`}
                        strokeWidth={selected || pending ? 3 : 2}
                      />
                      <text x={atom.x} y={atom.y + 5} textAnchor="middle" className="select-none fill-slate-950 text-[16px] font-bold">
                        {atom.element}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{sketchMessage}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <PeriodicTablePicker activeElement={activeElement} onSelectElement={handleSelectElement} />
            <div className="mt-4">
              <p className="text-sm font-semibold text-slate-800">Functional groups</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {FUNCTIONAL_GROUPS.map((group) => (
                  <button
                    key={group}
                    type="button"
                    onClick={() => appendFunctionalGroup(group)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:border-sky-300"
                  >
                    {group}
                  </button>
                ))}
              </div>
            </div>

            <label className="text-sm font-semibold text-slate-800" htmlFor="draw-smiles">
              Generated / editable SMILES
            </label>
            <textarea
              id="draw-smiles"
              value={draft}
              onChange={(event) => updateDraft(event.target.value)}
              className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 bg-white p-3 font-mono text-sm leading-6 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
              placeholder="Draw on the canvas or edit SMILES manually."
              spellCheck={false}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onGenerate3D(effectiveSmiles)}
              disabled={loading || !effectiveSmiles.trim()}
              className="rounded-xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Generate 3D Model'}
            </button>
            <button
              type="button"
              onClick={onExportSmiles}
              disabled={!effectiveSmiles.trim()}
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Export SMILES
            </button>
            <button
              type="button"
              onClick={resetSketch}
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Clear Drawing
            </button>
          </div>

          {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}

function BondLines({ from, to, order }: { from: AtomNode; to: AtomNode; order: BondOrder }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const ox = (-dy / length) * 5;
  const oy = (dx / length) * 5;
  const common = 'stroke-slate-800';

  if (order === 2) {
    return (
      <g className={common} strokeWidth={3} strokeLinecap="round">
        <line x1={from.x + ox} y1={from.y + oy} x2={to.x + ox} y2={to.y + oy} />
        <line x1={from.x - ox} y1={from.y - oy} x2={to.x - ox} y2={to.y - oy} />
      </g>
    );
  }

  if (order === 3) {
    return (
      <g className={common} strokeWidth={3} strokeLinecap="round">
        <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
        <line x1={from.x + ox * 1.6} y1={from.y + oy * 1.6} x2={to.x + ox * 1.6} y2={to.y + oy * 1.6} />
        <line x1={from.x - ox * 1.6} y1={from.y - oy * 1.6} x2={to.x - ox * 1.6} y2={to.y - oy * 1.6} />
      </g>
    );
  }

  if (order === 'aromatic') {
    return (
      <g className={common} strokeLinecap="round">
        <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} strokeWidth={3} />
        <line x1={from.x + ox * 1.6} y1={from.y + oy * 1.6} x2={to.x + ox * 1.6} y2={to.y + oy * 1.6} strokeWidth={2} strokeDasharray="6 6" />
      </g>
    );
  }

  return <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} className={common} strokeWidth={3} strokeLinecap="round" />;
}

function ToolIcon({ tool, activeElement }: { tool: DrawTool; activeElement: string }) {
  if (tool === 'Select') return <span className="text-lg leading-none">↖</span>;
  if (tool === 'Atom') return <span className="font-mono text-sm font-bold">{activeElement}</span>;
  if (tool === 'Erase') return <span className="text-lg leading-none">⌫</span>;
  if (tool === 'Ring') return <span className="text-lg leading-none">⬡</span>;
  if (tool === 'Aromatic Ring') return <span className="text-lg leading-none">◎</span>;

  const lineCount = tool === 'Triple Bond' ? 3 : tool === 'Double Bond' ? 2 : 1;
  return (
    <span className="flex h-5 w-8 flex-col items-center justify-center gap-0.5" aria-hidden="true">
      {Array.from({ length: lineCount }).map((_, index) => (
        <span key={index} className="block h-0.5 w-7 rounded-full bg-current" />
      ))}
    </span>
  );
}

function findAtomAt(atoms: AtomNode[], x: number, y: number) {
  return atoms.find((atom) => Math.hypot(atom.x - x, atom.y - y) <= ATOM_RADIUS + 8) ?? null;
}

function findBondAt(atoms: AtomNode[], bonds: BondEdge[], x: number, y: number) {
  return (
    bonds.find((bond) => {
      const from = atoms.find((atom) => atom.id === bond.from);
      const to = atoms.find((atom) => atom.id === bond.to);
      if (!from || !to) return false;
      return distanceToSegment({ x, y }, from, to) <= 8;
    }) ?? null
  );
}

function distanceToSegment(point: { x: number; y: number }, start: AtomNode, end: AtomNode) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  const projectionX = start.x + t * dx;
  const projectionY = start.y + t * dy;
  return Math.hypot(point.x - projectionX, point.y - projectionY);
}

function isBondTool(tool: DrawTool) {
  return tool === 'Single Bond' || tool === 'Double Bond' || tool === 'Triple Bond';
}

function orderForTool(tool: DrawTool): BondOrder {
  if (tool === 'Double Bond') return 2;
  if (tool === 'Triple Bond') return 3;
  return 1;
}

function labelForOrder(order: BondOrder) {
  if (order === 2) return 'double';
  if (order === 3) return 'triple';
  if (order === 'aromatic') return 'aromatic';
  return 'single';
}

function sameBond(bond: BondEdge, from: string, to: string) {
  return (bond.from === from && bond.to === to) || (bond.from === to && bond.to === from);
}

function cloneSketch(state: SketchState): SketchState {
  return {
    atoms: state.atoms.map((atom) => ({ ...atom })),
    bonds: state.bonds.map((bond) => ({ ...bond }))
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function graphToSmiles(atoms: AtomNode[], bonds: BondEdge[]) {
  if (atoms.length === 0) return '';
  if (atoms.length === 1) return atomToSmiles(atoms[0]);

  const ringSmiles = detectSimpleSixMemberRing(atoms, bonds);
  if (ringSmiles) return ringSmiles;

  if (hasCycle(atoms, bonds)) {
    return '';
  }

  const adjacency = new Map<string, Array<{ atomId: string; bond: BondEdge }>>();
  atoms.forEach((atom) => adjacency.set(atom.id, []));
  bonds.forEach((bond) => {
    adjacency.get(bond.from)?.push({ atomId: bond.to, bond });
    adjacency.get(bond.to)?.push({ atomId: bond.from, bond });
  });

  const visited = new Set<string>();
  const start = atoms.find((atom) => (adjacency.get(atom.id)?.length ?? 0) <= 1) ?? atoms[0];

  const walk = (atomId: string, parentId: string | null): string => {
    visited.add(atomId);
    const atom = atoms.find((item) => item.id === atomId);
    if (!atom) return '';
    const neighbors = (adjacency.get(atomId) ?? []).filter((entry) => entry.atomId !== parentId && !visited.has(entry.atomId));
    if (neighbors.length === 0) return atomToSmiles(atom);

    const [main, ...branches] = neighbors;
    const branchText = branches.map((entry) => `(${bondSymbol(entry.bond.order)}${walk(entry.atomId, atomId)})`).join('');
    return `${atomToSmiles(atom)}${branchText}${bondSymbol(main.bond.order)}${walk(main.atomId, atomId)}`;
  };

  const fragments = [walk(start.id, null)];
  atoms.forEach((atom) => {
    if (!visited.has(atom.id)) fragments.push(walk(atom.id, null));
  });
  return fragments.filter(Boolean).join('.');
}

function detectSimpleSixMemberRing(atoms: AtomNode[], bonds: BondEdge[]) {
  if (atoms.length !== 6 || bonds.length !== 6) return null;
  const degreeTwo = atoms.every((atom) => bonds.filter((bond) => bond.from === atom.id || bond.to === atom.id).length === 2);
  if (!degreeTwo) return null;
  const allCarbon = atoms.every((atom) => atom.element === 'C' || atom.element === 'c');
  if (!allCarbon) return null;
  const aromatic = bonds.every((bond) => bond.order === 'aromatic') || atoms.every((atom) => atom.element === 'c');
  return aromatic ? 'c1ccccc1' : 'C1CCCCC1';
}

function hasCycle(atoms: AtomNode[], bonds: BondEdge[]) {
  const adjacency = new Map<string, string[]>();
  atoms.forEach((atom) => adjacency.set(atom.id, []));
  bonds.forEach((bond) => {
    adjacency.get(bond.from)?.push(bond.to);
    adjacency.get(bond.to)?.push(bond.from);
  });

  const visited = new Set<string>();
  const visit = (atomId: string, parentId: string | null): boolean => {
    visited.add(atomId);
    for (const neighbor of adjacency.get(atomId) ?? []) {
      if (neighbor === parentId) continue;
      if (visited.has(neighbor)) return true;
      if (visit(neighbor, atomId)) return true;
    }
    return false;
  };

  return atoms.some((atom) => !visited.has(atom.id) && visit(atom.id, null));
}

function atomToSmiles(atom: AtomNode) {
  if (atom.element === 'c') return 'c';
  const organic = new Set(['B', 'C', 'N', 'O', 'P', 'S', 'F', 'Cl', 'Br', 'I']);
  return organic.has(atom.element) ? atom.element : `[${atom.element}]`;
}

function bondSymbol(order: BondOrder) {
  if (order === 2) return '=';
  if (order === 3) return '#';
  if (order === 'aromatic') return ':';
  return '';
}
