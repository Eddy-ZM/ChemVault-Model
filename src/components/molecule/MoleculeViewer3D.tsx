'use client';

import { ReactNode, forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

type Representation = 'ball-and-stick' | 'stick' | 'sphere' | 'line' | 'surface' | 'cartoon' | 'space-filling';
type StructureFormat = 'sdf' | 'mol' | 'molfile' | 'xyz' | 'pdb' | 'cif';
type LabelOptions = { position: { x: number; y: number; z: number }; backgroundColor: string; fontColor: string; fontSize: number; inFront: boolean; alignment: string };
type SurfaceType = { VDW: number };
type ThreeDMolAtom = { elem: string; x: number; y: number; z: number };
type ThreeDMolModel = { selectedAtoms: (query: unknown) => ThreeDMolAtom[] };
type ThreeDMolViewer = {
  setBackgroundColor: (color: string | number) => void;
  addModel: (modelData: string, format: string) => ThreeDMolModel;
  removeAllSurfaces?: () => void;
  removeAllLabels?: () => void;
  setStyle: (selector: unknown, style: unknown) => void;
  zoomTo: () => void;
  render: () => void;
  clear: () => void;
  addLabel: (text: string, options: LabelOptions) => void;
  addSurface: (type: number, options: { opacity: number }) => void;
  pngURI: () => string;
};
type ThreeDMolApi = { createViewer: (element: HTMLElement, options: { defaultcolors: unknown }) => ThreeDMolViewer; rasmolElementColors: unknown; SurfaceType: SurfaceType };

const THREE_DMOL_SOURCES = ['/vendor/3Dmol-min.js', 'https://unpkg.com/3dmol@2.5.5/build/3Dmol-min.js'];

export type MoleculeViewerHandle = {
  loadModel: (modelData: string | null, format?: StructureFormat) => Promise<void>;
  exportPng: () => string | null;
  setStyleConfig: (cfg: {
    representation?: Representation;
    backgroundColor?: string;
    showHydrogens?: boolean;
    showAtomLabels?: boolean;
  }) => void;
  resetView: () => void;
};

type Props = {
  loading?: boolean;
  children?: ReactNode;
  onReady?: () => void;
  initialRepresentation?: Representation;
  showHeader?: boolean;
};

function load3dmolScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }
    if ((window as { $3Dmol?: ThreeDMolApi }).$3Dmol) {
      resolve();
      return;
    }

    const existing = document.getElementById('threedmol-script') as HTMLScriptElement | null;
    if (existing) {
      if ((existing as HTMLScriptElement).dataset.loaded === '1') {
        resolve();
      } else {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener(
          'error',
          () => {
            reject(new Error('Failed to load 3Dmol library.'));
          },
          { once: true }
        );
      }
      return;
    }

    const loadSource = (sourceIndex: number) => {
      const source = THREE_DMOL_SOURCES[sourceIndex];
      if (!source) {
        reject(new Error('Failed to load 3Dmol script.'));
        return;
      }

      const script = document.createElement('script');
      script.id = 'threedmol-script';
      script.src = source;
      script.async = true;
      script.onload = () => {
        script.dataset.loaded = '1';
        resolve();
      };
      script.onerror = () => {
        script.remove();
        loadSource(sourceIndex + 1);
      };
      document.head.appendChild(script);
    };

    loadSource(0);
  });
}

function normalizeBackground(value: string) {
  if (value === 'black') return 'black';
  if (value === 'transparent') return 0x00000000;
  return 'white';
}

export const MoleculeViewer3D = forwardRef<MoleculeViewerHandle, Props>(function MoleculeViewer3D(
  { initialRepresentation = 'stick', onReady, children, showHeader = true },
  ref
) {
  const container = useRef<HTMLDivElement>(null);
  const viewer = useRef<ThreeDMolViewer | null>(null);
  const model = useRef<ThreeDMolModel | null>(null);
  const onReadyRef = useRef(onReady);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [representation, setRepresentation] = useState<Representation>(initialRepresentation);
  const [background, setBackground] = useState('white');
  const [showHydrogens, setShowHydrogens] = useState(true);
  const [showAtomLabels, setShowAtomLabels] = useState(false);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    let mounted = true;
    load3dmolScript()
      .then(() => {
        if (!mounted || !container.current) return;
        const threeDMol = (window as { $3Dmol?: ThreeDMolApi }).$3Dmol;
        if (!threeDMol) return;
        viewer.current = threeDMol.createViewer(container.current, { defaultcolors: threeDMol.rasmolElementColors });
        setReady(true);
        viewer.current.setBackgroundColor(normalizeBackground('white'));
        setError(null);
        onReadyRef.current?.();
      })
      .catch(() => {
        setError('3D viewer library could not be loaded.');
        setReady(false);
      });

    return () => {
      mounted = false;
      if (viewer.current) {
        viewer.current.clear();
      }
    };
  }, []);

  const applyStyle = useCallback(() => {
    if (!viewer.current || !model.current) return;

    try {
      viewer.current.removeAllSurfaces?.();
      if (viewer.current.removeAllLabels) viewer.current.removeAllLabels();

      const baseSelector = showHydrogens ? {} : { not: { elem: 'H' } };
      const repStyle = getStyleForRepresentation(representation);

      viewer.current.setStyle({}, {});
      viewer.current.setStyle(baseSelector, repStyle);
      if (!showHydrogens) {
        viewer.current.setStyle({ elem: 'H' }, {});
      }

      if (showAtomLabels && model.current?.selectedAtoms) {
        const atoms = model.current.selectedAtoms({});
        atoms.forEach((atom) => {
          if (!showHydrogens && atom.elem === 'H') return;
          if (!viewer.current) return;
          viewer.current.addLabel(atom.elem, {
            position: { x: atom.x, y: atom.y, z: atom.z },
            backgroundColor: 'rgba(255,255,255,0.7)',
            fontColor: 'black',
            fontSize: 10,
            inFront: true,
            alignment: 'center'
          });
        });
      }

      if (representation === 'cartoon') {
        viewer.current.setStyle({}, { cartoon: { color: 'spectrum' } });
      }

      if (representation === 'space-filling') {
        viewer.current.setStyle({}, { spheres: { scale: 1.0 }, stick: {} });
      }

      if (representation === 'surface') {
        viewer.current.setStyle({}, { cartoon: { color: 'spectrum' } });
        const threeDMol = (window as { $3Dmol?: ThreeDMolApi }).$3Dmol;
        if (!threeDMol?.SurfaceType) return;
        viewer.current.addSurface(threeDMol.SurfaceType.VDW, {
          opacity: 0.65
        });
      }

      viewer.current.zoomTo();
      viewer.current.render();
      setError(null);
    } catch {
      setError('Cannot render this structure with current style.');
      // defensive: keep interface stable even if 3dmol API differs by version
    }
  }, [representation, showHydrogens, showAtomLabels]);

  const loadModel = useCallback(
    async (modelData: string | null, format: StructureFormat = 'sdf') => {
      if (!ready || !viewer.current) return;
      if (!modelData) {
        viewer.current.clear();
        setError(null);
        return;
      }

      try {
        viewer.current.clear();
        const normalized = normalizeFormat(format);
        model.current = viewer.current.addModel(modelData, normalized);
        applyStyle();
        setError(null);
      } catch {
        setError('Unable to parse the loaded structure.');
      }
    },
    [applyStyle, ready]
  );

  useImperativeHandle(
    ref,
    () => ({
      loadModel: async (modelData: string | null, format: StructureFormat = 'sdf') => {
        if (!ready) return;
        await loadModel(modelData, format);
      },
      exportPng: () => {
        if (!viewer.current) return null;
        return viewer.current.pngURI();
      },
      resetView: () => {
        if (!viewer.current) return;
        try {
          viewer.current.zoomTo();
          viewer.current.render();
          setError(null);
        } catch {
          setError('Reset view failed on current renderer.');
        }
      },
      setStyleConfig: ({ representation: nextRepresentation, backgroundColor, showHydrogens: showHs, showAtomLabels: labels }) => {
        if (typeof nextRepresentation === 'string') {
          setRepresentation(nextRepresentation);
        }
        if (typeof backgroundColor === 'string') {
          setBackground(backgroundColor);
          viewer.current?.setBackgroundColor(normalizeBackground(backgroundColor));
        }
        if (typeof showHs === 'boolean') {
          setShowHydrogens(showHs);
        }
        if (typeof labels === 'boolean') {
          setShowAtomLabels(labels);
        }
        requestAnimationFrame(() => {
          applyStyle();
        });
      }
    }),
    [applyStyle, loadModel, ready]
  );

  useEffect(() => {
    if (!ready) return;
    applyStyle();
  }, [ready, representation, background, showHydrogens, showAtomLabels, applyStyle]);

  return (
    <div className="space-y-3">
      {showHeader ? <h2 className="text-lg font-semibold">3D Viewer</h2> : null}
      <div className="relative h-[55vh] min-h-[360px] w-full overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div ref={container} className="h-full w-full" />
        {!ready ? <div className="absolute inset-0 grid place-items-center text-sm font-semibold text-slate-600">Preparing viewer</div> : null}
        {error ? (
          <div className="absolute inset-x-2 top-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
            {error}
          </div>
        ) : null}
      </div>
      <div className="text-xs text-slate-500">High-fidelity molecular visualization engine</div>
      {children}
    </div>
  );
});

MoleculeViewer3D.displayName = 'MoleculeViewer3D';

function normalizeFormat(format: StructureFormat): string {
  if (format === 'mol') return 'mol';
  if (format === 'molfile') return 'mol';
  if (format === 'xyz') return 'xyz';
  if (format === 'pdb') return 'pdb';
  if (format === 'cif') return 'cif';
  return 'sdf';
}

function getStyleForRepresentation(representation: Representation) {
  if (representation === 'ball-and-stick') {
    return {
      stick: { radius: 0.2 },
      sphere: { scale: 0.3, color: 'spectrum' }
    };
  }

  if (representation === 'stick') {
    return {
      stick: { radius: 0.15 }
    };
  }

  if (representation === 'sphere') {
    return {
      sphere: { scale: 0.28 }
    };
  }

  if (representation === 'line') {
    return {
      line: { hidden: false, dashed: false }
    };
  }

  if (representation === 'cartoon') {
    return {
      cartoon: { color: 'spectrum' }
    };
  }

  if (representation === 'surface') {
    return {};
  }

  return {
    sphere: { scale: 1.0 },
    stick: { radius: 0.2 }
  };
}
