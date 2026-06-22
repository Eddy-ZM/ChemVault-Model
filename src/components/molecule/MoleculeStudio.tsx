'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MoleculeProperties, MoleculeGenerationResponse, PdbRecord } from '@/lib/chem/types';
import { downloadText, fileNameForFormat } from '@/lib/chem/fileExport';
import { emptyProperties } from '@/lib/chem/moleculeUtils';
import { MoleculeSketcher } from '@/components/molecule/MoleculeSketcher';
import { MoleculeViewer3D, MoleculeViewerHandle } from '@/components/molecule/MoleculeViewer3D';
import { MoleculeSearch } from '@/components/molecule/MoleculeSearch';
import { MoleculePropertiesPanel } from '@/components/molecule/MoleculePropertiesPanel';
import { ImportExportPanel } from '@/components/molecule/ImportExportPanel';
import { PDBViewerPanel } from '@/components/molecule/PDBViewerPanel';
import { Toolbar } from '@/components/molecule/Toolbar';

type StructureFormat = 'sdf' | 'mol' | 'xyz' | 'pdb' | 'cif';

type Toast = { id: number; text: string; level: 'error' | 'success' | 'info' };

type CurrentMoleculeInfo = {
  name?: string;
  smiles?: string;
  inchi?: string;
  inchikey?: string;
  formula?: string;
  molecularWeight?: number | null;
  cid?: string | null;
  dataSource?: 'initial' | 'manual' | 'pubchem' | 'import';
};

const INITIAL_SMILES = 'CCO';

type StructureState = {
  data: string | null;
  format: StructureFormat;
};

type SmilesChangeOptions = {
  preserveMetadata?: boolean;
  dataSource?: CurrentMoleculeInfo['dataSource'];
};

function metadataForSmiles(value: string, dataSource: CurrentMoleculeInfo['dataSource'] = 'manual'): CurrentMoleculeInfo {
  const trimmed = value.trim();
  return {
    name: trimmed ? (dataSource === 'import' ? 'Imported SMILES' : 'Manual SMILES') : undefined,
    smiles: value,
    cid: null,
    dataSource
  };
}

export function MoleculeStudio() {
  const viewerRef = useRef<MoleculeViewerHandle>(null);
  const [smiles, setSmiles] = useState(INITIAL_SMILES);
  const [metadata, setMetadata] = useState<CurrentMoleculeInfo>({
    name: 'ethanol',
    smiles: INITIAL_SMILES,
    dataSource: 'initial'
  });
  const [properties, setProperties] = useState<MoleculeProperties>(emptyProperties());

  const [structure, setStructure] = useState<StructureState>({ data: null, format: 'sdf' });
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loading3D, setLoading3D] = useState(false);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [loadingPdb, setLoadingPdb] = useState(false);
  const [loadingExport, setLoadingExport] = useState(false);
  const [toastMessages, setToastMessages] = useState<Toast[]>([]);

  const [representation, setRepresentation] = useState<
    'ball-and-stick' | 'stick' | 'sphere' | 'line' | 'surface' | 'cartoon' | 'space-filling'
  >('ball-and-stick');
  const [background, setBackground] = useState('white');
  const [showHydrogens, setShowHydrogens] = useState(true);
  const [showAtomLabels, setShowAtomLabels] = useState(false);

  const [pdbMeta, setPdbMeta] = useState<{ pdbId?: string; title?: string | null; resolution?: number | null; experimentalMethod?: string | null } | undefined>(undefined);

  const undoStack = useRef<string[]>([INITIAL_SMILES]);
  const redoStack = useRef<string[]>([]);

  const toast = useCallback((text: string, level: Toast['level'] = 'info') => {
    const id = Date.now() + Math.random();
    setToastMessages((prev) => [...prev, { id, text, level }]);
    window.setTimeout(() => {
      setToastMessages((prev) => prev.filter((item) => item.id !== id));
    }, 3500);
  }, []);

  const syncViewer = useCallback((nextData: string | null, nextFormat: StructureState['format']) => {
    setStructure({ data: nextData, format: nextFormat });
    try {
      if (!nextData) {
        viewerRef.current?.loadModel(null, nextFormat);
        return;
      }
      viewerRef.current?.loadModel(nextData, nextFormat);
    } catch {
      // ignored to keep UX resilient
    }
  }, []);

  const loadProperties = useCallback(
    async (value: string): Promise<MoleculeProperties | null> => {
      if (!value.trim()) {
        setProperties(emptyProperties());
        return null;
      }
      setLoadingProperties(true);
      try {
        const response = await fetch('/api/chem/properties', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ smiles: value })
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || 'Property calculation failed');
        }

        const nextProperties = {
          formula: payload.formula ?? null,
          molecularWeight: payload.molecularWeight ?? null,
          exactMass: payload.exactMass ?? null,
          logP: payload.logP ?? null,
          tpsa: payload.tpsa ?? null,
          hbd: payload.hbd ?? null,
          hba: payload.hba ?? null,
          rotatableBonds: payload.rotatableBonds ?? null,
          ringCount: payload.ringCount ?? null,
          heavyAtomCount: payload.heavyAtomCount ?? null,
          formalCharge: payload.formalCharge ?? null
        };

        setProperties(nextProperties);
        return nextProperties;
      } catch (error) {
        setProperties(emptyProperties());
        toast(error instanceof Error ? error.message : 'Property API failed', 'error');
        return null;
      } finally {
        setLoadingProperties(false);
      }
    },
    [toast]
  );

  const handleSmilesChange = useCallback(
    (value: string, options: SmilesChangeOptions = {}) => {
      setSmiles(value);
      setMetadata((prev) =>
        options.preserveMetadata
          ? { ...prev, smiles: value }
          : metadataForSmiles(value, options.dataSource ?? 'manual')
      );
      const last = undoStack.current[undoStack.current.length - 1];
      if (value !== last) {
        undoStack.current.push(value);
        redoStack.current = [];
      }
    },
    []
  );

  const handleUndo = useCallback(() => {
    if (undoStack.current.length <= 1) return;
    const current = undoStack.current.pop();
    const previous = undoStack.current[undoStack.current.length - 1];
    if (current) redoStack.current.push(current);
    if (previous !== undefined) {
      setSmiles(previous);
      setMetadata(metadataForSmiles(previous));
    }
  }, []);

  const handleRedo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(next);
    setSmiles(next);
    setMetadata(metadataForSmiles(next));
  }, []);

  const loadByQuery = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        toast('Please enter molecule name, smiles, CID, or InChIKey', 'error');
        return;
      }

      setLoadingSearch(true);
      try {
        const response = await fetch(`/api/chem/pubchem/search?query=${encodeURIComponent(query)}`);
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result?.error || 'Search failed');
        }

        const smilesValue = result.smiles || query;
        setMetadata({
          name: result.name || query,
          smiles: smilesValue,
          inchi: result.inchi || undefined,
          inchikey: result.inchikey || undefined,
          formula: result.formula || undefined,
          molecularWeight: result.molecularWeight || null,
          cid: result.cid || null,
          dataSource: 'pubchem'
        });
        handleSmilesChange(smilesValue, { preserveMetadata: true });

        if (result.cid) {
          const structureResp = await fetch(`/api/chem/pubchem/structure?cid=${result.cid}&format=sdf3d`);
          const structurePayload = await structureResp.json();
          if (structureResp.ok && structurePayload.data) {
            syncViewer(structurePayload.data, 'sdf');
          }
        }

        await loadProperties(smilesValue);
      } catch (error) {
        toast(error instanceof Error ? error.message : 'Search failed', 'error');
      } finally {
        setLoadingSearch(false);
      }
    },
    [handleSmilesChange, loadProperties, syncViewer, toast]
  );

  const generate3D = useCallback(async () => {
    if (!smiles.trim()) {
      toast('SMILES is empty', 'error');
      return;
    }
    setLoading3D(true);
    try {
      const response = await fetch('/api/chem/generate-3d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smiles })
      });
      const payload: MoleculeGenerationResponse & { error?: string } = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || '3D generation failed');
      }

      syncViewer(payload.data, 'sdf');
      const nextProperties = await loadProperties(smiles);
      setMetadata((prev) => ({
        ...(prev.dataSource === 'pubchem' && prev.smiles === smiles ? prev : metadataForSmiles(smiles)),
        smiles,
        formula: nextProperties?.formula ?? prev.formula,
        molecularWeight: nextProperties?.molecularWeight ?? prev.molecularWeight
      }));
      toast(`3D model generated (${payload.method})`, 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : '3D generation failed', 'error');
    } finally {
      setLoading3D(false);
    }
  }, [smiles, syncViewer, toast]);

  const loadPdb = useCallback(
    async (id: string) => {
      setLoadingPdb(true);
      setPdbMeta(undefined);
      try {
        const response = await fetch(`/api/chem/pdb/${encodeURIComponent(id)}`);
        const payload: PdbRecord & { error?: string } = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || 'PDB load failed');
        }

        syncViewer(payload.data, 'pdb');
        setPdbMeta({
          pdbId: payload.pdbId,
          title: payload.title,
          resolution: payload.resolution,
          experimentalMethod: payload.experimentalMethod
        });

        setRepresentation('cartoon');
        viewerRef.current?.setStyleConfig({ representation: 'cartoon', backgroundColor: background, showHydrogens, showAtomLabels });
      } catch (error) {
        toast(error instanceof Error ? error.message : 'PDB load failed', 'error');
      } finally {
        setLoadingPdb(false);
      }
    },
    [background, showHydrogens, showAtomLabels, syncViewer, toast]
  );

  const exportFile = useCallback(
    (content: string | null, format: 'smi' | StructureFormat) => {
      if (!content) {
        toast('No data available for this export format.', 'error');
        return;
      }
      const ext = format === 'smi' ? 'smi' : format;
      downloadText(fileNameForFormat(ext, metadata.smiles ?? 'molecule'), content, mimeForFormat(format));
    },
    [metadata.smiles, toast]
  );

  const exportSmiles = useCallback(() => {
    exportFile(smiles, 'smi');
  }, [smiles, exportFile]);

  const exportMol = useCallback(() => {
    exportFile(structure.data, 'mol');
  }, [exportFile, structure.data]);

  const exportSdf = useCallback(() => {
    exportFile(structure.data, 'sdf');
  }, [exportFile, structure.data]);

  const exportXyz = useCallback(() => {
    exportFile(structure.data, 'xyz');
  }, [exportFile, structure.data]);

  const exportPdb = useCallback(() => {
    exportFile(structure.data, 'pdb');
  }, [exportFile, structure.data]);

  const exportPng = useCallback(async () => {
    setLoadingExport(true);
    try {
      const uri = viewerRef.current?.exportPng();
      if (!uri) {
        toast('3D viewer has no image yet.', 'error');
      } else {
        const response = await fetch(uri);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${(metadata.smiles ?? 'molecule').replace(/[^a-zA-Z0-9-_]/g, '_')}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch {
      toast('PNG export failed.', 'error');
    } finally {
      setLoadingExport(false);
    }
  }, [metadata.smiles, toast]);

  const onImportSmiles = useCallback(
    (value: string) => {
      handleSmilesChange(value, { dataSource: 'import' });
      syncViewer(null, 'sdf');
      loadProperties(value);
      toast('SMILES imported');
    },
    [handleSmilesChange, syncViewer, loadProperties, toast]
  );

  const onImportText = useCallback(
    (value: string, format: 'sdf' | 'mol' | 'xyz' | 'pdb' | 'cif') => {
      syncViewer(value, format);
      toast(`Imported ${format.toUpperCase()} file`);
    },
    [syncViewer, toast]
  );

  const clearSketch = useCallback(() => {
    undoStack.current = [''];
    redoStack.current = [];
    setSmiles('');
    setMetadata(metadataForSmiles(''));
    setProperties(emptyProperties());
    syncViewer(null, 'sdf');
  }, [syncViewer]);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && event.shiftKey) {
        event.preventDefault();
        handleRedo();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        exportFile(`${smiles}` , 'smi');
      }
    };
    window.addEventListener('keydown', keyDown);
    return () => window.removeEventListener('keydown', keyDown);
  }, [exportFile, handleRedo, handleUndo, smiles]);

  useEffect(() => {
    viewerRef.current?.setStyleConfig({
      representation,
      backgroundColor: background,
      showHydrogens,
      showAtomLabels
    });
    if (structure.data) {
      viewerRef.current?.loadModel(structure.data, structure.format);
    }
  }, [background, representation, showAtomLabels, showHydrogens, structure.data, structure.format]);

  useEffect(() => {
    if (smiles && structure.data === null) {
      loadProperties(smiles);
    }
  }, [smiles, loadProperties, structure.data]);

  const toastClass = useCallback((level: Toast['level']) => {
    if (level === 'error') return 'border-rose-200 text-rose-700';
    if (level === 'success') return 'border-emerald-200 text-emerald-700';
    return 'border-sky-200 text-sky-700';
  }, []);

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-8">
          <h1 className="text-xl font-bold">ChemVault Molecule Studio</h1>
          <p className="text-sm text-slate-600">Academic molecular modeling workspace</p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-8">
        <section className="surface-card space-y-4">
          <p className="text-sm text-slate-600">
            Draw a molecule, paste SMILES, or search PubChem to begin.
          </p>

          <div className="grid gap-4 lg:grid-cols-[1.05fr_1.2fr]">
            <aside className="space-y-6">
              <MoleculeSearch onSearch={loadByQuery} loading={loadingSearch} />
              <MoleculeSketcher
                smiles={smiles}
                onChange={handleSmilesChange}
                onUndo={handleUndo}
                onRedo={handleRedo}
                onClear={clearSketch}
                loading={loading3D || loadingSearch}
              />
              <Toolbar
                onGenerate3D={generate3D}
                loadingGenerate3d={loading3D}
                loadingExport={loadingExport}
                generatingDisabled={!smiles.trim()}
                onUndo={handleUndo}
                onRedo={handleRedo}
                onClear={clearSketch}
                onResetView={() => viewerRef.current?.resetView()}
                onExportPng={exportPng}
                loadingMessage={loading3D ? 'Generating 3D geometry…' : ''}
                representation={representation}
                background={background}
                onRepresentationChange={setRepresentation}
                onBackgroundChange={setBackground}
                onHydrogensToggle={() => setShowHydrogens((value) => !value)}
                showHydrogens={showHydrogens}
                onLabelsToggle={() => setShowAtomLabels((value) => !value)}
                showAtomLabels={showAtomLabels}
              />
              <ImportExportPanel
                onImportSmiles={onImportSmiles}
                onImportText={onImportText}
                onExportMol={exportMol}
                onExportSdf={exportSdf}
                onExportXyz={exportXyz}
                onExportPdb={exportPdb}
                onExportSmi={exportSmiles}
                loadingExport={loadingExport}
              />
              <PDBViewerPanel onLoadPdb={loadPdb} loading={loadingPdb} metadata={pdbMeta} />
            </aside>

            <section className="space-y-6">
              <MoleculeViewer3D
                ref={viewerRef}
                loading={loading3D || loadingSearch}
                initialRepresentation={representation}
                onReady={() => {
                  if (structure.data) {
                    viewerRef.current?.loadModel(structure.data, structure.format);
                  }
                }}
              />
              <MoleculePropertiesPanel
                metadata={metadata}
                properties={properties}
                loading={loadingProperties}
                onCopy={(value) => {
                  navigator.clipboard?.writeText(value).catch(() => {});
                }}
              />
            </section>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-7xl px-4 py-6 text-center text-xs text-slate-500 md:px-8">
        ChemVault Molecule Studio is an independent educational chemistry tool. It is not affiliated with MolView, PubChem, or RCSB
        PDB.
      </footer>

      <div className="pointer-events-none fixed right-4 top-4 z-20 flex flex-col gap-2 md:right-6">
        {toastMessages.map((item) => (
          <div
            key={item.id}
            className={`toast pointer-events-auto max-w-[min(80vw,360px)] border ${toastClass(item.level)} bg-white/95`}
          >
            <span>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function mimeForFormat(format: 'smi' | StructureFormat) {
  if (format === 'smi') return 'text/plain';
  if (format === 'mol' || format === 'sdf') return 'chemical/x-mdl-molfile';
  if (format === 'xyz') return 'chemical/x-xyz';
  if (format === 'pdb' || format === 'cif') return 'chemical/x-pdb';
  return 'text/plain';
}
