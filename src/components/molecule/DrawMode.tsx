'use client';

import { MouseEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { EngineSpinner } from '@/components/ui/LoadingState';
import { normalizeSmiles } from '@/lib/chem/smiles';
import { PeriodicElement, PeriodicTablePicker } from '@/components/molecule/PeriodicTablePicker';

const VIEWBOX_WIDTH = 900;
const VIEWBOX_HEIGHT = 520;
const ATOM_RADIUS = 18;
const BOND_LENGTH = 78;
const DRAG_THRESHOLD = 8;

const DRAW_TOOLS = [
  'Select',
  'Move',
  'Erase',
  'Single Bond',
  'Double Bond',
  'Triple Bond',
  'Aromatic Bond',
  'Wedge Bond',
  'Dash Bond'
] as const;

type RingTemplate = {
  id: string;
  label: string;
  short: string;
  size: number;
  aromatic: boolean;
  hetero?: { index: number; element: string };
};

const RING_TEMPLATES: RingTemplate[] = [
  { id: 'cyclopropane', label: 'Cyclopropane', short: 'C3', size: 3, aromatic: false },
  { id: 'cyclobutane', label: 'Cyclobutane', short: 'C4', size: 4, aromatic: false },
  { id: 'cyclopentane', label: 'Cyclopentane', short: 'C5', size: 5, aromatic: false },
  { id: 'cyclohexane', label: 'Cyclohexane', short: 'C6', size: 6, aromatic: false },
  { id: 'benzene', label: 'Benzene', short: 'Bz', size: 6, aromatic: true },
  { id: 'pyridine', label: 'Pyridine', short: 'Py', size: 6, aromatic: true, hetero: { index: 0, element: 'n' } },
  { id: 'furan', label: 'Furan', short: 'Fu', size: 5, aromatic: true, hetero: { index: 0, element: 'o' } },
  { id: 'thiophene', label: 'Thiophene', short: 'Th', size: 5, aromatic: true, hetero: { index: 0, element: 's' } }
] as const;

const FUNCTIONAL_GROUPS = ['OH', 'NH2', 'COOH', 'CHO', 'NO2', 'OMe', 'Acetyl', 'Phenyl'] as const;

type DrawTool = (typeof DRAW_TOOLS)[number] | 'Atom';
type BondOrder = 1 | 2 | 3 | 'aromatic' | 'wedge' | 'dash';
type FunctionalGroup = (typeof FUNCTIONAL_GROUPS)[number];
type AtomNode = { id: string; x: number; y: number; element: string };
type BondEdge = { id: string; from: string; to: string; order: BondOrder };
type SketchState = { atoms: AtomNode[]; bonds: BondEdge[] };
type ViewBox = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };
type DragState =
  | { mode: 'move'; atomId: string; moved: boolean; latestAtoms: AtomNode[] }
  | { mode: 'draw'; fromAtomId: string; start: Point; current: Point; moved: boolean; order: BondOrder };

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  onGenerate3D: (value: string) => Promise<void>;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  loading?: boolean;
  error?: string | null;
};

export function DrawMode({ value, onValueChange, onGenerate3D, onClear, loading, error }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const history = useRef<SketchState[]>([{ atoms: [], bonds: [] }]);
  const redoHistory = useRef<SketchState[]>([]);
  const idCounter = useRef(0);
  const dragState = useRef<DragState | null>(null);
  const suppressNextClick = useRef(false);

  const [activeTool, setActiveTool] = useState<DrawTool>('Select');
  const [activeElement, setActiveElement] = useState('C');
  const [elementLocked, setElementLocked] = useState(false);
  const [activeRing, setActiveRing] = useState<RingTemplate | null>(null);
  const [activeGroup, setActiveGroup] = useState<FunctionalGroup | null>(null);
  const [selectedAtomId, setSelectedAtomId] = useState<string | null>(null);
  const [pendingBondAtomId, setPendingBondAtomId] = useState<string | null>(null);
  const [atoms, setAtoms] = useState<AtomNode[]>([]);
  const [bonds, setBonds] = useState<BondEdge[]>([]);
  const [draft, setDraft] = useState(value);
  const [viewBox, setViewBox] = useState<ViewBox>({ x: 0, y: 0, width: VIEWBOX_WIDTH, height: VIEWBOX_HEIGHT });
  const [previewBond, setPreviewBond] = useState<{ from: AtomNode; to: Point; order: BondOrder } | null>(null);
  const [sketchMessage, setSketchMessage] = useState(
    'Click empty canvas to place carbon. Drag from an atom to extend a bond. Click a bond to cycle its type.'
  );

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const generatedFromSketch = useMemo(() => graphToSmiles(atoms, bonds), [atoms, bonds]);
  const effectiveSmiles = generatedFromSketch.trim() ? generatedFromSketch : normalizeSmiles(draft);

  const updateDraft = (next: string) => {
    setDraft(next);
    onValueChange(next);
  };

  const nextId = (prefix: string) => {
    idCounter.current += 1;
    return `${prefix}-${idCounter.current}`;
  };

  const commitSketch = (nextState: SketchState, message?: string) => {
    const cloned = cloneSketch(nextState);
    setAtoms(cloned.atoms);
    setBonds(cloned.bonds);
    history.current.push(cloneSketch(cloned));
    redoHistory.current = [];
    updateDraft(graphToSmiles(cloned.atoms, cloned.bonds));
    if (message) setSketchMessage(message);
  };

  const setTool = (tool: DrawTool) => {
    setActiveTool(tool);
    setActiveRing(null);
    setActiveGroup(null);
    setPendingBondAtomId(null);
    setSketchMessage(tool === 'Move' ? 'Move mode: drag atoms to reposition them.' : `${tool} selected.`);
  };

  const undoSketch = () => {
    if (history.current.length <= 1) return;
    const current = history.current.pop();
    if (current) redoHistory.current.push(current);
    const previous = cloneSketch(history.current[history.current.length - 1] ?? { atoms: [], bonds: [] });
    setAtoms(previous.atoms);
    setBonds(previous.bonds);
    updateDraft(graphToSmiles(previous.atoms, previous.bonds));
    setSelectedAtomId(null);
    setPendingBondAtomId(null);
    setPreviewBond(null);
    setSketchMessage('Undo applied.');
  };

  const redoSketch = () => {
    const next = redoHistory.current.pop();
    if (!next) return;
    const cloned = cloneSketch(next);
    history.current.push(cloneSketch(cloned));
    setAtoms(cloned.atoms);
    setBonds(cloned.bonds);
    updateDraft(graphToSmiles(cloned.atoms, cloned.bonds));
    setSelectedAtomId(null);
    setPendingBondAtomId(null);
    setPreviewBond(null);
    setSketchMessage('Redo applied.');
  };

  const resetSketch = (requireConfirm = true) => {
    if (requireConfirm && (atoms.length > 0 || bonds.length > 0) && !window.confirm('Clear the current drawing?')) return;
    history.current = [{ atoms: [], bonds: [] }];
    redoHistory.current = [];
    setAtoms([]);
    setBonds([]);
    setSelectedAtomId(null);
    setPendingBondAtomId(null);
    setPreviewBond(null);
    setActiveRing(null);
    setActiveGroup(null);
    updateDraft('');
    onClear();
    setSketchMessage('Sketch cleared. Click the canvas to place a carbon atom.');
  };

  const getCanvasPoint = (event: MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: viewBox.x + ((event.clientX - rect.left) / rect.width) * viewBox.width,
      y: viewBox.y + ((event.clientY - rect.top) / rect.height) * viewBox.height
    };
  };

  const handleCanvasMouseDown = (event: MouseEvent<SVGSVGElement>) => {
    const point = getCanvasPoint(event);
    const hitAtom = findAtomAt(atoms, point.x, point.y);
    if (!hitAtom) return;

    if (activeTool === 'Move') {
      dragState.current = { mode: 'move', atomId: hitAtom.id, moved: false, latestAtoms: atoms };
      setSelectedAtomId(hitAtom.id);
      event.preventDefault();
      return;
    }

    if (activeTool === 'Select' || activeTool === 'Atom' || isBondTool(activeTool)) {
      dragState.current = {
        mode: 'draw',
        fromAtomId: hitAtom.id,
        start: point,
        current: point,
        moved: false,
        order: isBondTool(activeTool) ? orderForTool(activeTool) : 1
      };
      setSelectedAtomId(hitAtom.id);
      event.preventDefault();
    }
  };

  const handleCanvasMouseMove = (event: MouseEvent<SVGSVGElement>) => {
    const currentDrag = dragState.current;
    if (!currentDrag) return;
    const point = getCanvasPoint(event);

    if (currentDrag.mode === 'move') {
      const nextAtoms = atoms.map((atom) =>
        atom.id === currentDrag.atomId
          ? { ...atom, x: clamp(point.x, 28, VIEWBOX_WIDTH - 28), y: clamp(point.y, 28, VIEWBOX_HEIGHT - 28) }
          : atom
      );
      currentDrag.latestAtoms = nextAtoms;
      currentDrag.moved = true;
      setAtoms(nextAtoms);
      suppressNextClick.current = true;
      return;
    }

    const distance = Math.hypot(point.x - currentDrag.start.x, point.y - currentDrag.start.y);
    if (distance < DRAG_THRESHOLD) return;
    const source = atoms.find((atom) => atom.id === currentDrag.fromAtomId);
    if (!source) return;
    currentDrag.current = point;
    currentDrag.moved = true;
    setPreviewBond({ from: source, to: point, order: currentDrag.order });
    suppressNextClick.current = true;
  };

  const endCanvasDrag = (event?: MouseEvent<SVGSVGElement>) => {
    const currentDrag = dragState.current;
    if (!currentDrag) return;

    if (currentDrag.mode === 'move') {
      dragState.current = null;
      if (currentDrag.moved) {
        commitSketch({ atoms: currentDrag.latestAtoms, bonds }, 'Atom moved.');
      }
      return;
    }

    dragState.current = null;
    setPreviewBond(null);
    if (!currentDrag.moved) return;

    const releasePoint = event ? getCanvasPoint(event) : currentDrag.current;
    const source = atoms.find((atom) => atom.id === currentDrag.fromAtomId);
    if (!source) return;
    const hitAtom = findAtomAt(atoms, releasePoint.x, releasePoint.y, source.id);

    if (hitAtom) {
      upsertBond(source.id, hitAtom.id, currentDrag.order, `Added ${labelForOrder(currentDrag.order)} bond.`);
      setSelectedAtomId(hitAtom.id);
      setPendingBondAtomId(hitAtom.id);
      return;
    }

    const newAtom = {
      id: nextId('atom'),
      x: clamp(releasePoint.x, 28, VIEWBOX_WIDTH - 28),
      y: clamp(releasePoint.y, 28, VIEWBOX_HEIGHT - 28),
      element: activeElement
    };
    const newBond = { id: nextId('bond'), from: source.id, to: newAtom.id, order: currentDrag.order };
    commitSketch({ atoms: [...atoms, newAtom], bonds: [...bonds, newBond] }, `Extended ${labelForOrder(currentDrag.order)} bond to ${activeElement}.`);
    setSelectedAtomId(newAtom.id);
    setPendingBondAtomId(newAtom.id);
  };

  const handleCanvasClick = (event: MouseEvent<SVGSVGElement>) => {
    if (suppressNextClick.current) {
      suppressNextClick.current = false;
      return;
    }

    const point = getCanvasPoint(event);
    const hitAtom = findAtomAt(atoms, point.x, point.y);
    const hitBond = hitAtom ? null : findBondAt(atoms, bonds, point.x, point.y);

    if (activeRing) {
      addRingTemplate(activeRing, point, hitAtom);
      return;
    }

    if (activeGroup) {
      attachFunctionalGroup(activeGroup, point, hitAtom ?? (selectedAtomId ? atoms.find((atom) => atom.id === selectedAtomId) ?? null : null));
      return;
    }

    if (hitBond) {
      if (activeTool === 'Erase') {
        removeBond(hitBond.id);
      } else if (isBondTool(activeTool)) {
        changeBondOrder(hitBond.id, orderForTool(activeTool));
      } else {
        cycleBond(hitBond.id);
      }
      return;
    }

    if (activeTool === 'Erase') {
      if (hitAtom) removeAtom(hitAtom.id);
      return;
    }

    if (isBondTool(activeTool)) {
      placeBondByClick(point, orderForTool(activeTool), hitAtom);
      return;
    }

    if (hitAtom) {
      if (activeTool === 'Atom' || elementLocked) {
        changeAtomElement(hitAtom.id, activeElement);
        return;
      }
      setSelectedAtomId(hitAtom.id);
      setPendingBondAtomId(hitAtom.id);
      setSketchMessage(`Selected ${hitAtom.element}. Drag from it to create a bond or choose an element to replace it.`);
      return;
    }

    if (activeTool !== 'Move') {
      addAtom(point.x, point.y, activeElement);
    } else {
      setSelectedAtomId(null);
      setPendingBondAtomId(null);
    }
  };

  const addAtom = (x: number, y: number, element: string) => {
    const atom = { id: nextId('atom'), x: clamp(x, 28, VIEWBOX_WIDTH - 28), y: clamp(y, 28, VIEWBOX_HEIGHT - 28), element };
    commitSketch({ atoms: [...atoms, atom], bonds }, `Placed ${element}.`);
    setSelectedAtomId(atom.id);
    setPendingBondAtomId(atom.id);
  };

  const changeAtomElement = (atomId: string, element: string) => {
    const nextAtoms = atoms.map((atom) => (atom.id === atomId ? { ...atom, element } : atom));
    commitSketch({ atoms: nextAtoms, bonds }, `Atom changed to ${element}.`);
    setSelectedAtomId(atomId);
    setPendingBondAtomId(atomId);
  };

  const placeBondByClick = (point: Point, order: BondOrder, hitAtom: AtomNode | null) => {
    const anchorId = pendingBondAtomId ?? selectedAtomId;

    if (hitAtom) {
      if (anchorId && anchorId !== hitAtom.id) {
        upsertBond(anchorId, hitAtom.id, order, `Added ${labelForOrder(order)} bond.`);
      }
      setSelectedAtomId(hitAtom.id);
      setPendingBondAtomId(hitAtom.id);
      setSketchMessage(`Bond start set at ${hitAtom.element}. Click another atom or blank canvas to extend.`);
      return;
    }

    if (anchorId) {
      const source = atoms.find((atom) => atom.id === anchorId);
      if (!source) return;
      const angle = Math.atan2(point.y - source.y, point.x - source.x);
      const safeAngle = Number.isFinite(angle) ? angle : 0;
      const atom = {
        id: nextId('atom'),
        x: clamp(source.x + Math.cos(safeAngle) * BOND_LENGTH, 28, VIEWBOX_WIDTH - 28),
        y: clamp(source.y + Math.sin(safeAngle) * BOND_LENGTH, 28, VIEWBOX_HEIGHT - 28),
        element: activeElement
      };
      const bond = { id: nextId('bond'), from: source.id, to: atom.id, order };
      commitSketch({ atoms: [...atoms, atom], bonds: [...bonds, bond] }, `Placed ${labelForOrder(order)} bond to ${activeElement}.`);
      setSelectedAtomId(atom.id);
      setPendingBondAtomId(atom.id);
      return;
    }

    const atomA = { id: nextId('atom'), x: clamp(point.x - BOND_LENGTH / 2, 28, VIEWBOX_WIDTH - 28), y: point.y, element: 'C' };
    const atomB = { id: nextId('atom'), x: clamp(point.x + BOND_LENGTH / 2, 28, VIEWBOX_WIDTH - 28), y: point.y, element: activeElement };
    const bond = { id: nextId('bond'), from: atomA.id, to: atomB.id, order };
    commitSketch({ atoms: [...atoms, atomA, atomB], bonds: [...bonds, bond] }, `Placed ${labelForOrder(order)} bond.`);
    setSelectedAtomId(atomB.id);
    setPendingBondAtomId(atomB.id);
  };

  const upsertBond = (from: string, to: string, order: BondOrder, message: string) => {
    const existing = bonds.find((bond) => sameBond(bond, from, to));
    if (existing) {
      changeBondOrder(existing.id, order);
      return;
    }
    const bond = { id: nextId('bond'), from, to, order };
    commitSketch({ atoms, bonds: [...bonds, bond] }, message);
  };

  const changeBondOrder = (bondId: string, order: BondOrder) => {
    const nextBonds = bonds.map((bond) => (bond.id === bondId ? { ...bond, order } : bond));
    commitSketch({ atoms, bonds: nextBonds }, `Bond set to ${labelForOrder(order)}.`);
  };

  const cycleBond = (bondId: string) => {
    const sequence: BondOrder[] = [1, 2, 3, 'aromatic'];
    const current = bonds.find((bond) => bond.id === bondId);
    if (!current) return;
    const currentIndex = sequence.indexOf(current.order);
    const nextOrder = sequence[(currentIndex + 1) % sequence.length] ?? 1;
    changeBondOrder(bondId, nextOrder);
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

  const addRingTemplate = (template: RingTemplate, point: Point, anchorAtom: AtomNode | null) => {
    const radius = ringRadius(template.size);
    const centerX = anchorAtom ? clamp(anchorAtom.x + radius + 44, 110, VIEWBOX_WIDTH - 110) : clamp(point.x, 110, VIEWBOX_WIDTH - 110);
    const centerY = anchorAtom ? clamp(anchorAtom.y, 110, VIEWBOX_HEIGHT - 110) : clamp(point.y, 110, VIEWBOX_HEIGHT - 110);
    const startAngle = anchorAtom ? Math.PI : -Math.PI / 2;
    const ringAtoms: AtomNode[] = Array.from({ length: template.size }, (_, index) => {
      const angle = startAngle + (index * Math.PI * 2) / template.size;
      const element = template.hetero?.index === index ? template.hetero.element : template.aromatic ? 'c' : 'C';
      return {
        id: nextId('atom'),
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        element
      };
    });
    const ringBonds: BondEdge[] = ringAtoms.map((atom, index) => ({
      id: nextId('bond'),
      from: atom.id,
      to: ringAtoms[(index + 1) % ringAtoms.length].id,
      order: template.aromatic ? 'aromatic' : 1
    }));
    const attachmentBond: BondEdge[] = anchorAtom ? [{ id: nextId('bond'), from: anchorAtom.id, to: ringAtoms[0].id, order: 1 }] : [];

    commitSketch(
      { atoms: [...atoms, ...ringAtoms], bonds: [...bonds, ...ringBonds, ...attachmentBond] },
      anchorAtom ? `${template.label} attached.` : `${template.label} placed.`
    );
    setSelectedAtomId(ringAtoms[0].id);
    setPendingBondAtomId(ringAtoms[0].id);
  };

  const attachFunctionalGroup = (group: FunctionalGroup, point: Point, anchorAtom: AtomNode | null) => {
    if (group === 'Phenyl') {
      addRingTemplate(RING_TEMPLATES[4], point, anchorAtom);
      setActiveGroup(null);
      return;
    }

    const baseAngle = anchorAtom ? preferredAngle(anchorAtom, atoms, bonds) : 0;
    const origin = anchorAtom ?? { id: '', x: point.x, y: point.y, element: 'C' };
    const nextAtoms = [...atoms];
    const nextBonds = [...bonds];

    const addFragmentAtom = (element: string, distance: number, perpendicular = 0) => {
      const atom = {
        id: nextId('atom'),
        x: clamp(origin.x + Math.cos(baseAngle) * distance + Math.cos(baseAngle + Math.PI / 2) * perpendicular, 28, VIEWBOX_WIDTH - 28),
        y: clamp(origin.y + Math.sin(baseAngle) * distance + Math.sin(baseAngle + Math.PI / 2) * perpendicular, 28, VIEWBOX_HEIGHT - 28),
        element
      };
      nextAtoms.push(atom);
      return atom;
    };

    const addFragmentBond = (from: AtomNode, to: AtomNode, order: BondOrder) => {
      nextBonds.push({ id: nextId('bond'), from: from.id, to: to.id, order });
    };

    const attachFirst = (first: AtomNode, order: BondOrder = 1) => {
      if (anchorAtom) addFragmentBond(anchorAtom, first, order);
    };

    if (group === 'OH') {
      const oxygen = addFragmentAtom('O', anchorAtom ? BOND_LENGTH : 0);
      attachFirst(oxygen);
      const hydrogen = addFragmentAtom('H', anchorAtom ? BOND_LENGTH * 1.85 : BOND_LENGTH * 0.85);
      addFragmentBond(oxygen, hydrogen, 1);
    }

    if (group === 'NH2') {
      const nitrogen = addFragmentAtom('N', anchorAtom ? BOND_LENGTH : 0);
      attachFirst(nitrogen);
      const h1 = addFragmentAtom('H', anchorAtom ? BOND_LENGTH * 1.75 : BOND_LENGTH * 0.75, 24);
      const h2 = addFragmentAtom('H', anchorAtom ? BOND_LENGTH * 1.75 : BOND_LENGTH * 0.75, -24);
      addFragmentBond(nitrogen, h1, 1);
      addFragmentBond(nitrogen, h2, 1);
    }

    if (group === 'COOH') {
      const carbon = addFragmentAtom('C', anchorAtom ? BOND_LENGTH : 0);
      attachFirst(carbon);
      const oxygenDouble = addFragmentAtom('O', anchorAtom ? BOND_LENGTH * 1.75 : BOND_LENGTH * 0.75, 25);
      const oxygenSingle = addFragmentAtom('O', anchorAtom ? BOND_LENGTH * 1.75 : BOND_LENGTH * 0.75, -25);
      const hydrogen = addFragmentAtom('H', anchorAtom ? BOND_LENGTH * 2.45 : BOND_LENGTH * 1.45, -35);
      addFragmentBond(carbon, oxygenDouble, 2);
      addFragmentBond(carbon, oxygenSingle, 1);
      addFragmentBond(oxygenSingle, hydrogen, 1);
    }

    if (group === 'CHO') {
      const carbon = addFragmentAtom('C', anchorAtom ? BOND_LENGTH : 0);
      attachFirst(carbon);
      const oxygen = addFragmentAtom('O', anchorAtom ? BOND_LENGTH * 1.75 : BOND_LENGTH * 0.75, 24);
      const hydrogen = addFragmentAtom('H', anchorAtom ? BOND_LENGTH * 1.75 : BOND_LENGTH * 0.75, -24);
      addFragmentBond(carbon, oxygen, 2);
      addFragmentBond(carbon, hydrogen, 1);
    }

    if (group === 'NO2') {
      const nitrogen = addFragmentAtom('N', anchorAtom ? BOND_LENGTH : 0);
      attachFirst(nitrogen);
      const o1 = addFragmentAtom('O', anchorAtom ? BOND_LENGTH * 1.75 : BOND_LENGTH * 0.75, 24);
      const o2 = addFragmentAtom('O', anchorAtom ? BOND_LENGTH * 1.75 : BOND_LENGTH * 0.75, -24);
      addFragmentBond(nitrogen, o1, 2);
      addFragmentBond(nitrogen, o2, 1);
    }

    if (group === 'OMe') {
      const oxygen = addFragmentAtom('O', anchorAtom ? BOND_LENGTH : 0);
      attachFirst(oxygen);
      const carbon = addFragmentAtom('C', anchorAtom ? BOND_LENGTH * 1.85 : BOND_LENGTH * 0.85);
      addFragmentBond(oxygen, carbon, 1);
    }

    if (group === 'Acetyl') {
      const carbonyl = addFragmentAtom('C', anchorAtom ? BOND_LENGTH : 0);
      attachFirst(carbonyl);
      const oxygen = addFragmentAtom('O', anchorAtom ? BOND_LENGTH * 1.75 : BOND_LENGTH * 0.75, 25);
      const methyl = addFragmentAtom('C', anchorAtom ? BOND_LENGTH * 1.75 : BOND_LENGTH * 0.75, -25);
      addFragmentBond(carbonyl, oxygen, 2);
      addFragmentBond(carbonyl, methyl, 1);
    }

    commitSketch({ atoms: nextAtoms, bonds: nextBonds }, anchorAtom ? `${group} attached.` : `${group} placed.`);
    setActiveGroup(null);
    const newestAtom = nextAtoms[nextAtoms.length - 1];
    setSelectedAtomId(newestAtom?.id ?? null);
    setPendingBondAtomId(newestAtom?.id ?? null);
  };

  const handleSelectElement = (element: PeriodicElement) => {
    setActiveElement(element.symbol);
    setActiveTool('Atom');
    setElementLocked(false);
    setActiveRing(null);
    setActiveGroup(null);
    setSketchMessage(`Active element set to ${element.symbol}. Click an atom to replace it or blank canvas to place it.`);
  };

  const handleLockElement = (element: PeriodicElement) => {
    setActiveElement(element.symbol);
    setActiveTool('Atom');
    setElementLocked(true);
    setActiveRing(null);
    setActiveGroup(null);
    setSketchMessage(`${element.symbol} locked. Click repeatedly to place or replace atoms.`);
  };

  const clean2d = () => {
    if (atoms.length === 0) {
      setSketchMessage('Draw a structure before cleaning the layout.');
      return;
    }
    centerStructure('Clean 2D applied a lightweight centering pass. Full force-field layout is reserved for a future sketcher upgrade.');
  };

  const centerStructure = (message = 'Structure centered.') => {
    if (atoms.length === 0) {
      setViewBox({ x: 0, y: 0, width: VIEWBOX_WIDTH, height: VIEWBOX_HEIGHT });
      setSketchMessage('Canvas centered.');
      return;
    }
    const box = boundingBox(atoms);
    const dx = VIEWBOX_WIDTH / 2 - (box.minX + box.maxX) / 2;
    const dy = VIEWBOX_HEIGHT / 2 - (box.minY + box.maxY) / 2;
    const nextAtoms = atoms.map((atom) => ({ ...atom, x: clamp(atom.x + dx, 28, VIEWBOX_WIDTH - 28), y: clamp(atom.y + dy, 28, VIEWBOX_HEIGHT - 28) }));
    commitSketch({ atoms: nextAtoms, bonds }, message);
    setViewBox({ x: 0, y: 0, width: VIEWBOX_WIDTH, height: VIEWBOX_HEIGHT });
  };

  const fitToScreen = () => {
    if (atoms.length === 0) {
      setViewBox({ x: 0, y: 0, width: VIEWBOX_WIDTH, height: VIEWBOX_HEIGHT });
      return;
    }
    const box = boundingBox(atoms);
    const padding = 95;
    const width = Math.max(260, box.maxX - box.minX + padding * 2);
    const height = Math.max(180, box.maxY - box.minY + padding * 2);
    setViewBox({
      x: clamp(box.minX - padding, -VIEWBOX_WIDTH * 0.4, VIEWBOX_WIDTH * 0.4),
      y: clamp(box.minY - padding, -VIEWBOX_HEIGHT * 0.4, VIEWBOX_HEIGHT * 0.4),
      width: Math.min(width, VIEWBOX_WIDTH),
      height: Math.min(height, VIEWBOX_HEIGHT)
    });
    setSketchMessage('Fit to screen applied.');
  };

  const zoomBy = (factor: number) => {
    setViewBox((current) => {
      const centerX = current.x + current.width / 2;
      const centerY = current.y + current.height / 2;
      const nextWidth = clamp(current.width / factor, 220, VIEWBOX_WIDTH * 1.25);
      const nextHeight = clamp(current.height / factor, 150, VIEWBOX_HEIGHT * 1.25);
      return { x: centerX - nextWidth / 2, y: centerY - nextHeight / 2, width: nextWidth, height: nextHeight };
    });
  };

  const copySmiles = async () => {
    if (!effectiveSmiles.trim()) {
      setSketchMessage('Draw a molecule first.');
      return;
    }
    try {
      await navigator.clipboard.writeText(effectiveSmiles);
      setSketchMessage('SMILES copied.');
    } catch {
      setSketchMessage('Clipboard is unavailable in this browser.');
    }
  };

  const handleGenerate = async () => {
    if (!effectiveSmiles.trim()) {
      setSketchMessage('Draw a molecule first.');
      return;
    }
    try {
      await onGenerate3D(effectiveSmiles);
    } catch {
      setSketchMessage('3D generation failed. Try Search or SMILES as a fallback.');
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Draw Molecule</h2>
          <p className="text-xs text-slate-500">Click to place atoms, drag from atoms to extend bonds, click bonds to cycle order.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">Tool: {activeTool}</span>
          <span className="rounded-full bg-sky-50 px-3 py-1 font-mono font-semibold text-sky-800">Element: {activeElement}</span>
          {elementLocked ? <span className="rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-800">Locked</span> : null}
        </div>
      </div>

      <div className="mt-3 grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_220px]">
        <div className="flex min-h-0 flex-col gap-3">
          <div className="relative min-h-[360px] flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.12)_1px,transparent_0)] bg-[length:26px_26px]">
            <div className="absolute left-3 top-3 z-10 flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white/95 p-1.5 shadow-sm backdrop-blur">
              {DRAW_TOOLS.map((tool) => (
                <button
                  key={tool}
                  type="button"
                  title={tool}
                  aria-label={tool}
                  onClick={() => setTool(tool)}
                  className={`grid h-9 w-9 place-items-center rounded-lg border text-xs font-semibold transition ${
                    activeTool === tool ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-sky-300'
                  }`}
                >
                  <ToolIcon tool={tool} activeElement={activeElement} />
                </button>
              ))}
            </div>

            <div className="absolute right-3 top-3 z-10 flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white/95 p-1.5 shadow-sm backdrop-blur">
              <CanvasAction label="Undo" short="Undo" onClick={undoSketch} />
              <CanvasAction label="Redo" short="Redo" onClick={redoSketch} />
              <CanvasAction label="Clean 2D" short="Clean" onClick={clean2d} />
              <CanvasAction label="Center structure" short="Ctr" onClick={() => centerStructure()} />
              <CanvasAction label="Zoom in" short="+" onClick={() => zoomBy(1.22)} />
              <CanvasAction label="Zoom out" short="-" onClick={() => zoomBy(0.82)} />
              <CanvasAction label="Fit to screen" short="Fit" onClick={fitToScreen} />
              <CanvasAction label="Clear drawing" short="Clear" onClick={() => resetSketch(true)} />
            </div>

            <svg
              ref={svgRef}
              viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={endCanvasDrag}
              onMouseLeave={endCanvasDrag}
              onClick={handleCanvasClick}
              className="h-full min-h-[360px] w-full touch-none"
              role="img"
              aria-label="2D molecule drawing canvas"
            >
              {bonds.map((bond) => {
                const from = atoms.find((atom) => atom.id === bond.from);
                const to = atoms.find((atom) => atom.id === bond.to);
                if (!from || !to) return null;
                return <BondLines key={bond.id} from={from} to={to} order={bond.order} />;
              })}
              {previewBond ? <BondLines from={previewBond.from} to={{ ...previewBond.to, id: 'preview', element: activeElement }} order={previewBond.order} preview /> : null}
              {atoms.map((atom) => {
                const selected = atom.id === selectedAtomId;
                const pending = atom.id === pendingBondAtomId;
                return (
                  <g key={atom.id} className="cursor-crosshair">
                    <circle
                      cx={atom.x}
                      cy={atom.y}
                      r={ATOM_RADIUS}
                      className={`${selected || pending ? 'fill-sky-100 stroke-sky-700' : 'fill-white stroke-slate-700'}`}
                      strokeWidth={selected || pending ? 3 : 2}
                    />
                    <text x={atom.x} y={atom.y + 5} textAnchor="middle" className="select-none fill-slate-950 text-[15px] font-bold">
                      {formatAtomLabel(atom.element)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">{sketchMessage}</p>
        </div>

        <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <PeriodicTablePicker activeElement={activeElement} onSelectElement={handleSelectElement} onLockElement={handleLockElement} />

          <TemplateGroup title="Rings">
            {RING_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                title={template.label}
                onClick={() => {
                  setActiveRing(template);
                  setActiveGroup(null);
                  setActiveTool('Select');
                  setSketchMessage(`${template.label} selected. Click the canvas or an atom to place it.`);
                }}
                className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${
                  activeRing?.id === template.id ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-sky-300'
                }`}
              >
                {template.short}
              </button>
            ))}
          </TemplateGroup>

          <TemplateGroup title="Functional groups">
            {FUNCTIONAL_GROUPS.map((group) => (
              <button
                key={group}
                type="button"
                onClick={() => {
                  setActiveGroup(group);
                  setActiveRing(null);
                  setActiveTool('Select');
                  setSketchMessage(`${group} selected. Click an atom to attach it or blank canvas to place it.`);
                }}
                className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${
                  activeGroup === group ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-sky-300'
                }`}
              >
                {group}
              </button>
            ))}
          </TemplateGroup>

          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500" htmlFor="draw-smiles">
              SMILES
            </label>
            <textarea
              id="draw-smiles"
              value={draft}
              onChange={(event) => updateDraft(normalizeSmiles(event.target.value))}
              className="mt-2 h-20 w-full resize-none rounded-xl border border-slate-300 bg-white p-2 font-mono text-xs leading-5 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
              placeholder="Generated from drawing, or edit manually."
              spellCheck={false}
            />
          </div>

          <div className="grid gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading || !effectiveSmiles.trim()}
              className="rounded-xl bg-sky-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <EngineSpinner size="xs" decorative className="cv-engine-spinner-on-dark" />
                  Generating
                </span>
              ) : (
                'Generate 3D Model'
              )}
            </button>
            <button type="button" onClick={copySmiles} disabled={!effectiveSmiles.trim()} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
              Copy SMILES
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
            {atoms.length} atoms / {bonds.length} bonds
          </div>
        </aside>
      </div>

      {error ? <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
    </section>
  );
}

function CanvasAction({ label, short, onClick }: { label: string; short: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="grid h-9 w-12 place-items-center rounded-lg border border-slate-300 bg-white text-[11px] font-semibold text-slate-700 hover:border-sky-300"
    >
      {short}
    </button>
  );
}

function TemplateGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">{children}</div>
    </div>
  );
}

function ToolIcon({ tool, activeElement }: { tool: DrawTool; activeElement: string }) {
  if (tool === 'Select') return <span className="text-[11px]">Sel</span>;
  if (tool === 'Move') return <span className="text-[11px]">Move</span>;
  if (tool === 'Erase') return <span className="text-[11px]">Del</span>;
  if (tool === 'Wedge Bond') return <span className="text-[11px]">Wed</span>;
  if (tool === 'Dash Bond') return <span className="text-[11px]">Dash</span>;
  if (tool === 'Atom') return <span className="font-mono text-sm font-bold">{activeElement}</span>;

  const lineCount = tool === 'Triple Bond' ? 3 : tool === 'Double Bond' ? 2 : 1;
  const dashed = tool === 'Aromatic Bond';
  return (
    <span className="flex h-5 w-7 flex-col items-center justify-center gap-0.5" aria-hidden="true">
      {Array.from({ length: lineCount }).map((_, index) => (
        <span key={index} className={`block h-0.5 w-6 rounded-full bg-current ${dashed ? 'opacity-70' : ''}`} />
      ))}
    </span>
  );
}

function BondLines({ from, to, order, preview = false }: { from: AtomNode; to: AtomNode; order: BondOrder; preview?: boolean }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const ox = (-dy / length) * 5;
  const oy = (dx / length) * 5;
  const strokeClass = preview ? 'stroke-sky-500 opacity-60' : 'stroke-slate-800';

  if (order === 2) {
    return (
      <g className={strokeClass} strokeWidth={3} strokeLinecap="round">
        <line x1={from.x + ox} y1={from.y + oy} x2={to.x + ox} y2={to.y + oy} />
        <line x1={from.x - ox} y1={from.y - oy} x2={to.x - ox} y2={to.y - oy} />
      </g>
    );
  }

  if (order === 3) {
    return (
      <g className={strokeClass} strokeWidth={3} strokeLinecap="round">
        <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
        <line x1={from.x + ox * 1.6} y1={from.y + oy * 1.6} x2={to.x + ox * 1.6} y2={to.y + oy * 1.6} />
        <line x1={from.x - ox * 1.6} y1={from.y - oy * 1.6} x2={to.x - ox * 1.6} y2={to.y - oy * 1.6} />
      </g>
    );
  }

  if (order === 'aromatic') {
    return (
      <g className={strokeClass} strokeLinecap="round">
        <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} strokeWidth={3} />
        <line x1={from.x + ox * 1.6} y1={from.y + oy * 1.6} x2={to.x + ox * 1.6} y2={to.y + oy * 1.6} strokeWidth={2} strokeDasharray="6 6" />
      </g>
    );
  }

  if (order === 'dash') {
    return <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} className={strokeClass} strokeWidth={3} strokeLinecap="round" strokeDasharray="6 6" />;
  }

  if (order === 'wedge') {
    const endOx = ox * 1.8;
    const endOy = oy * 1.8;
    return <polygon points={`${from.x},${from.y} ${to.x + endOx},${to.y + endOy} ${to.x - endOx},${to.y - endOy}`} className={preview ? 'fill-sky-500 opacity-40' : 'fill-slate-800'} />;
  }

  return <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} className={strokeClass} strokeWidth={3} strokeLinecap="round" />;
}

function findAtomAt(atoms: AtomNode[], x: number, y: number, excludeId?: string) {
  return atoms.find((atom) => atom.id !== excludeId && Math.hypot(atom.x - x, atom.y - y) <= ATOM_RADIUS + 8) ?? null;
}

function findBondAt(atoms: AtomNode[], bonds: BondEdge[], x: number, y: number) {
  return (
    bonds.find((bond) => {
      const from = atoms.find((atom) => atom.id === bond.from);
      const to = atoms.find((atom) => atom.id === bond.to);
      if (!from || !to) return false;
      return distanceToSegment({ x, y }, from, to) <= 9;
    }) ?? null
  );
}

function distanceToSegment(point: Point, start: AtomNode, end: AtomNode) {
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
  return tool === 'Single Bond' || tool === 'Double Bond' || tool === 'Triple Bond' || tool === 'Aromatic Bond' || tool === 'Wedge Bond' || tool === 'Dash Bond';
}

function orderForTool(tool: DrawTool): BondOrder {
  if (tool === 'Double Bond') return 2;
  if (tool === 'Triple Bond') return 3;
  if (tool === 'Aromatic Bond') return 'aromatic';
  if (tool === 'Wedge Bond') return 'wedge';
  if (tool === 'Dash Bond') return 'dash';
  return 1;
}

function labelForOrder(order: BondOrder) {
  if (order === 2) return 'double';
  if (order === 3) return 'triple';
  if (order === 'aromatic') return 'aromatic';
  if (order === 'wedge') return 'wedge';
  if (order === 'dash') return 'dash';
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

function ringRadius(size: number) {
  if (size === 3) return 48;
  if (size === 4) return 58;
  if (size === 5) return 66;
  return 74;
}

function preferredAngle(anchor: AtomNode, atoms: AtomNode[], bonds: BondEdge[]) {
  const neighbors = bonds
    .filter((bond) => bond.from === anchor.id || bond.to === anchor.id)
    .map((bond) => atoms.find((atom) => atom.id === (bond.from === anchor.id ? bond.to : bond.from)))
    .filter(Boolean) as AtomNode[];

  if (neighbors.length === 0) return 0;
  const average = neighbors.reduce(
    (acc, atom) => ({ x: acc.x + atom.x - anchor.x, y: acc.y + atom.y - anchor.y }),
    { x: 0, y: 0 }
  );
  return Math.atan2(-average.y, -average.x);
}

function boundingBox(atoms: AtomNode[]) {
  return atoms.reduce(
    (box, atom) => ({
      minX: Math.min(box.minX, atom.x),
      minY: Math.min(box.minY, atom.y),
      maxX: Math.max(box.maxX, atom.x),
      maxY: Math.max(box.maxY, atom.y)
    }),
    { minX: atoms[0]?.x ?? 0, minY: atoms[0]?.y ?? 0, maxX: atoms[0]?.x ?? 0, maxY: atoms[0]?.y ?? 0 }
  );
}

function graphToSmiles(atoms: AtomNode[], bonds: BondEdge[]) {
  if (atoms.length === 0) return '';
  if (atoms.length === 1) return atomToSmiles(atoms[0]);

  const ringSmiles = detectSimpleRingSmiles(atoms, bonds);
  if (ringSmiles) return ringSmiles;
  if (hasCycle(atoms, bonds)) return '';

  const adjacency = new Map<string, Array<{ atomId: string; bond: BondEdge }>>();
  atoms.forEach((atom) => adjacency.set(atom.id, []));
  bonds.forEach((bond) => {
    adjacency.get(bond.from)?.push({ atomId: bond.to, bond });
    adjacency.get(bond.to)?.push({ atomId: bond.from, bond });
  });

  const root = atoms.find((atom) => (adjacency.get(atom.id)?.length ?? 0) <= 1) ?? atoms[0];
  const visited = new Set<string>();

  const walk = (atomId: string, parentId?: string): string => {
    visited.add(atomId);
    const atom = atoms.find((candidate) => candidate.id === atomId);
    if (!atom) return '';
    const neighbors = (adjacency.get(atomId) ?? []).filter((neighbor) => neighbor.atomId !== parentId && !visited.has(neighbor.atomId));
    if (neighbors.length === 0) return atomToSmiles(atom);

    const [mainNeighbor, ...branches] = neighbors;
    const branchText = branches
      .map((neighbor) => `(${bondSymbol(neighbor.bond.order)}${walk(neighbor.atomId, atomId)})`)
      .join('');
    return `${atomToSmiles(atom)}${branchText}${bondSymbol(mainNeighbor.bond.order)}${walk(mainNeighbor.atomId, atomId)}`;
  };

  return walk(root.id);
}

function detectSimpleRingSmiles(atoms: AtomNode[], bonds: BondEdge[]) {
  if (atoms.length < 3 || atoms.length !== bonds.length) return '';
  const degree = new Map(atoms.map((atom) => [atom.id, 0]));
  bonds.forEach((bond) => {
    degree.set(bond.from, (degree.get(bond.from) ?? 0) + 1);
    degree.set(bond.to, (degree.get(bond.to) ?? 0) + 1);
  });
  if ([...degree.values()].some((value) => value !== 2)) return '';

  const ordered = orderCycleAtoms(atoms, bonds);
  if (ordered.length !== atoms.length) return '';
  const aromatic = bonds.every((bond) => bond.order === 'aromatic');

  if (aromatic) {
    if (atoms.length === 6) {
      const first = ordered.find((atom) => atom.element === 'n') ?? ordered[0];
      const rotated = rotateCycle(ordered, first.id);
      return `${atomToSmiles(rotated[0])}1${rotated.slice(1).map(atomToSmiles).join('')}1`;
    }
    if (atoms.length === 5) {
      const first = ordered.find((atom) => atom.element === 'o' || atom.element === 's' || atom.element === 'n') ?? ordered[0];
      const rotated = rotateCycle(ordered, first.id);
      return `${atomToSmiles(rotated[0])}1${rotated.slice(1).map(atomToSmiles).join('')}1`;
    }
  }

  if (atoms.every((atom) => atom.element === 'C') && atoms.length >= 3 && atoms.length <= 6) {
    return `C1${'C'.repeat(atoms.length - 1)}1`;
  }

  return '';
}

function orderCycleAtoms(atoms: AtomNode[], bonds: BondEdge[]) {
  const adjacency = new Map<string, string[]>();
  atoms.forEach((atom) => adjacency.set(atom.id, []));
  bonds.forEach((bond) => {
    adjacency.get(bond.from)?.push(bond.to);
    adjacency.get(bond.to)?.push(bond.from);
  });

  const ordered: AtomNode[] = [];
  let current = atoms[0]?.id;
  let previous = '';
  while (current && ordered.length < atoms.length) {
    const atom = atoms.find((candidate) => candidate.id === current);
    if (!atom) break;
    ordered.push(atom);
    const neighbors = adjacency.get(current) ?? [];
    const next = neighbors.find((neighbor) => neighbor !== previous && !ordered.some((candidate) => candidate.id === neighbor));
    previous = current;
    current = next ?? '';
  }
  return ordered;
}

function rotateCycle(atoms: AtomNode[], startId: string) {
  const index = atoms.findIndex((atom) => atom.id === startId);
  if (index <= 0) return atoms;
  return [...atoms.slice(index), ...atoms.slice(0, index)];
}

function hasCycle(atoms: AtomNode[], bonds: BondEdge[]) {
  const adjacency = new Map<string, string[]>();
  atoms.forEach((atom) => adjacency.set(atom.id, []));
  bonds.forEach((bond) => {
    adjacency.get(bond.from)?.push(bond.to);
    adjacency.get(bond.to)?.push(bond.from);
  });

  const visited = new Set<string>();
  const visit = (atomId: string, parentId?: string): boolean => {
    visited.add(atomId);
    for (const neighbor of adjacency.get(atomId) ?? []) {
      if (neighbor === parentId) continue;
      if (visited.has(neighbor)) return true;
      if (visit(neighbor, atomId)) return true;
    }
    return false;
  };

  return atoms.some((atom) => !visited.has(atom.id) && visit(atom.id));
}

function atomToSmiles(atom: AtomNode) {
  const element = atom.element;
  if (element === element.toLowerCase()) return element;
  if (['B', 'C', 'N', 'O', 'P', 'S', 'F', 'Cl', 'Br', 'I'].includes(element)) return element;
  if (element === 'H') return '[H]';
  return `[${element}]`;
}

function bondSymbol(order: BondOrder) {
  if (order === 2) return '=';
  if (order === 3) return '#';
  if (order === 'aromatic') return ':';
  return '';
}

function formatAtomLabel(element: string) {
  return element.length === 1 ? element.toUpperCase() : element.charAt(0).toUpperCase() + element.slice(1);
}
