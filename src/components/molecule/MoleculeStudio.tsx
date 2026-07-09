'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MoleculeApiPayload, MoleculeGenerationResponse, MoleculeProperties, PdbRecord } from '@/lib/chem/types';
import { downloadText, fileNameForFormat, safeFileBaseName } from '@/lib/chem/fileExport';
import { emptyProperties } from '@/lib/chem/moleculeUtils';
import { normalizeSmiles } from '@/lib/chem/smiles';
import { MoleculeViewerHandle } from '@/components/molecule/MoleculeViewer3D';
import { MoleculeMode, MoleculeModeTabs } from '@/components/molecule/MoleculeModeTabs';
import { SearchMode } from '@/components/molecule/SearchMode';
import { SmilesMode } from '@/components/molecule/SmilesMode';
import { DrawMode } from '@/components/molecule/DrawMode';
import { UploadMode, UploadPayload } from '@/components/molecule/UploadMode';
import { PdbMode } from '@/components/molecule/PdbMode';
import { ViewerPanel } from '@/components/molecule/ViewerPanel';
import { MoleculePropertiesPanel } from '@/components/molecule/MoleculePropertiesPanel';
import { DisplayControls, Representation } from '@/components/molecule/DisplayControls';
import { ExportNameSource, ExportPanel } from '@/components/molecule/ExportPanel';
import { AuthButton } from '@/components/auth/AuthButton';
import { GlobalLoadingOverlay } from '@/components/ui/LoadingState';

type StructureFormat = 'sdf' | 'mol' | 'xyz' | 'pdb' | 'cif';
type MoleculeSource = 'search' | 'smiles' | 'draw' | 'upload' | 'pdb';
type Toast = { id: number; text: string; level: 'error' | 'success' | 'info' };
type SearchCandidate = MoleculeApiPayload;
type SearchCandidateState = { query: string; candidates: SearchCandidate[] };
type SearchCacheEntry = { candidates: SearchCandidate[]; needsSelection: boolean };

type CurrentMolecule = {
  name?: string;
  source: MoleculeSource;
  smiles?: string | null;
  cid?: string | null;
  formula?: string | null;
  molecularWeight?: number | null;
  inchi?: string | null;
  inchikey?: string | null;
  iupacName?: string | null;
  structureData?: string | null;
  structureFormat?: StructureFormat | null;
  pdbId?: string | null;
  fileName?: string | null;
};

type StructureState = {
  data: string | null;
  format: StructureFormat;
};

const INITIAL_SMILES = '';
const initialModeErrors: Record<MoleculeMode, string | null> = {
  search: null,
  smiles: null,
  draw: null,
  upload: null,
  pdb: null
};

export function MoleculeStudio() {
  const viewerRef = useRef<MoleculeViewerHandle>(null);
  const undoStack = useRef<string[]>([INITIAL_SMILES]);
  const redoStack = useRef<string[]>([]);
  const initialPropertiesLoaded = useRef(false);
  const propertyCache = useRef(new Map<string, MoleculeProperties>());
  const searchResultCache = useRef(new Map<string, SearchCacheEntry>());
  const structureCache = useRef(new Map<string, string>());

  const [activeMode, setActiveMode] = useState<MoleculeMode>('search');
  const [smiles, setSmiles] = useState(INITIAL_SMILES);
  const [currentMolecule, setCurrentMolecule] = useState<CurrentMolecule>({
    source: 'smiles',
    smiles: null
  });
  const [properties, setProperties] = useState<MoleculeProperties>(emptyProperties());
  const [structure, setStructure] = useState<StructureState>({ data: null, format: 'sdf' });
  const [modeErrors, setModeErrors] = useState<Record<MoleculeMode, string | null>>(initialModeErrors);
  const [toastMessages, setToastMessages] = useState<Toast[]>([]);
  const [searchCandidateState, setSearchCandidateState] = useState<SearchCandidateState | null>(null);

  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loading3D, setLoading3D] = useState(false);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [loadingPdb, setLoadingPdb] = useState(false);
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [loadingExport, setLoadingExport] = useState(false);

  const [representation, setRepresentation] = useState<Representation>('ball-and-stick');
  const [background, setBackground] = useState('white');
  const [showHydrogens, setShowHydrogens] = useState(true);
  const [showAtomLabels, setShowAtomLabels] = useState(false);
  const [exportNameSource, setExportNameSource] = useState<ExportNameSource>('auto');
  const [customExportName, setCustomExportName] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [pdbMeta, setPdbMeta] = useState<{ pdbId?: string; title?: string | null; resolution?: number | null; experimentalMethod?: string | null } | undefined>(undefined);
  const allowCartoonRepresentation = activeMode === 'pdb' || structure.format === 'pdb' || structure.format === 'cif';
  const effectiveRepresentation = allowCartoonRepresentation || representation !== 'cartoon' ? representation : 'ball-and-stick';

  const toast = useCallback((text: string, level: Toast['level'] = 'info') => {
    const id = Date.now() + Math.random();
    setToastMessages((prev) => [...prev, { id, text, level }]);
    window.setTimeout(() => {
      setToastMessages((prev) => prev.filter((item) => item.id !== id));
    }, 3500);
  }, []);

  const setModeError = useCallback((mode: MoleculeMode, message: string | null) => {
    setModeErrors((prev) => ({ ...prev, [mode]: message }));
  }, []);

  const clearModeError = useCallback(
    (mode: MoleculeMode) => {
      setModeError(mode, null);
    },
    [setModeError]
  );

  const syncViewer = useCallback((nextData: string | null, nextFormat: StructureFormat) => {
    setStructure({ data: nextData, format: nextFormat });
    setCurrentMolecule((prev) => ({ ...prev, structureData: nextData, structureFormat: nextFormat }));
    try {
      viewerRef.current?.loadModel(nextData, nextFormat);
    } catch {
      toast('3D viewer could not load this structure.', 'error');
    }
  }, [toast]);

  const pushSmilesHistory = useCallback((value: string) => {
    const last = undoStack.current[undoStack.current.length - 1];
    if (value !== last) {
      undoStack.current.push(value);
      redoStack.current = [];
    }
  }, []);

  const updateSmilesDraft = useCallback(
    (value: string) => {
      setSmiles(value);
      setCurrentMolecule((prev) => ({ ...prev, smiles: value }));
      pushSmilesHistory(value);
    },
    [pushSmilesHistory]
  );

  const loadProperties = useCallback(
    async (value: string): Promise<MoleculeProperties | null> => {
      const normalized = normalizeSmiles(value);
      if (!normalized.trim()) {
        setProperties(emptyProperties());
        return null;
      }

      const cached = propertyCache.current.get(normalized);
      if (cached) {
        setProperties(cached);
        return cached;
      }

      setLoadingProperties(true);
      try {
        const response = await fetch('/api/chem/properties', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ smiles: normalized })
        });
        const payload = await readApiResponse<Partial<MoleculeProperties> & { error?: string }>(response, 'Property calculation failed');
        if (!response.ok) {
          throw new Error(apiErrorMessage(payload.error, 'Property calculation failed'));
        }

        const nextProperties: MoleculeProperties = {
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
        propertyCache.current.set(normalized, nextProperties);
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

  const handleUndo = useCallback(() => {
    if (undoStack.current.length <= 1) return;
    const current = undoStack.current.pop();
    const previous = undoStack.current[undoStack.current.length - 1];
    if (current) redoStack.current.push(current);
    if (previous !== undefined) {
      setSmiles(previous);
      setCurrentMolecule((prev) => ({ ...prev, smiles: previous }));
    }
  }, []);

  const handleRedo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(next);
    setSmiles(next);
    setCurrentMolecule((prev) => ({ ...prev, smiles: next }));
  }, []);

  const clearStudio = useCallback(() => {
    undoStack.current = [''];
    redoStack.current = [];
    setSmiles('');
    setCurrentMolecule({ source: activeMode === 'pdb' ? 'pdb' : 'smiles', smiles: null, structureData: null, structureFormat: 'sdf' });
    setProperties(emptyProperties());
    setPdbMeta(undefined);
    syncViewer(null, 'sdf');
  }, [activeMode, syncViewer]);

  const generate3DFromSmiles = useCallback(
    async (rawValue: string, source: MoleculeSource, metadata: Partial<CurrentMolecule> = {}, modeForError: MoleculeMode = 'smiles') => {
      const nextSmiles = normalizeSmiles(rawValue);
      if (!nextSmiles) {
        const message = 'SMILES is empty.';
        setModeError(modeForError, message);
        toast(message, 'error');
        return;
      }

      clearModeError(modeForError);
      setLoading3D(true);
      setSmiles(nextSmiles);
      pushSmilesHistory(nextSmiles);

      try {
        const generationPromise = fetch('/api/chem/generate-3d', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ smiles: nextSmiles })
        }).then(async (response) => {
          const payload = await readApiResponse<MoleculeGenerationResponse & { error?: string; cid?: string | null }>(response, '3D generation failed');
          if (!response.ok || !payload.success) {
            throw new Error(apiErrorMessage(payload.error, '3D generation failed'));
          }
          return payload;
        });
        const propertiesPromise = loadProperties(nextSmiles);
        const [payload, nextProperties] = await Promise.all([generationPromise, propertiesPromise]);

        syncViewer(payload.data, 'sdf');
        setCurrentMolecule((prev) => ({
          ...prev,
          ...metadata,
          source,
          name: metadata.name || (source === 'draw' ? 'Drawn molecule' : source === 'upload' ? 'Imported SMILES' : 'SMILES molecule'),
          smiles: nextSmiles,
          cid: metadata.cid ?? payload.cid ?? prev.cid ?? null,
          formula: nextProperties?.formula ?? metadata.formula ?? prev.formula ?? null,
          molecularWeight: nextProperties?.molecularWeight ?? metadata.molecularWeight ?? prev.molecularWeight ?? null,
          structureData: payload.data,
          structureFormat: 'sdf',
          pdbId: null
        }));
        setPdbMeta(undefined);
        toast(`3D model loaded (${payload.method})`, 'success');
      } catch (error) {
        const message = error instanceof Error ? error.message : '3D generation failed';
        setModeError(modeForError, message);
        toast(message, 'error');
      } finally {
        setLoading3D(false);
      }
    },
    [clearModeError, loadProperties, pushSmilesHistory, setModeError, syncViewer, toast]
  );

  const fetchStructureForCid = useCallback(async (cid: string) => {
    const cached = structureCache.current.get(cid);
    if (cached) return cached;

    const structureResp = await fetch(`/api/chem/pubchem/structure?cid=${encodeURIComponent(cid)}&format=sdf3d`);
    const structurePayload = await readApiResponse<{ error?: string; data?: string }>(structureResp, 'PubChem structure fetch failed');
    if (!structureResp.ok || !structurePayload.data) {
      throw new Error(apiErrorMessage(structurePayload.error, 'PubChem structure fetch failed'));
    }
    structureCache.current.set(cid, structurePayload.data);
    return structurePayload.data;
  }, []);

  const loadSearchResult = useCallback(
    async (result: SearchCandidate, fallbackName: string) => {
      const nextSmiles = result.smiles || result.canonicalSmiles || '';
      if (!nextSmiles) {
        throw new Error('PubChem did not return a SMILES string for this query.');
      }

      setSmiles(nextSmiles);
      pushSmilesHistory(nextSmiles);
      setCurrentMolecule({
        source: 'search',
        name: result.name || result.matchedName || fallbackName,
        smiles: nextSmiles,
        inchi: result.inchi ?? null,
        inchikey: result.inchikey ?? null,
        formula: result.formula ?? null,
        molecularWeight: result.molecularWeight ?? null,
        cid: result.cid ?? null,
        structureData: null,
        structureFormat: 'sdf'
      });

      if (result.cid) {
        const [nextProperties, structureData] = await Promise.all([loadProperties(nextSmiles), fetchStructureForCid(result.cid)]);
        syncViewer(structureData, 'sdf');
        setCurrentMolecule((prev) => ({
          ...prev,
          formula: prev.formula ?? nextProperties?.formula ?? null,
          molecularWeight: prev.molecularWeight ?? nextProperties?.molecularWeight ?? null,
          structureData,
          structureFormat: 'sdf'
        }));
      } else {
        await generate3DFromSmiles(nextSmiles, 'search', { name: result.name || result.matchedName || fallbackName, cid: result.cid ?? null }, 'search');
      }

      setPdbMeta(undefined);
      toast('PubChem result loaded.', 'success');
    },
    [fetchStructureForCid, generate3DFromSmiles, loadProperties, pushSmilesHistory, syncViewer, toast]
  );

  const loadByQuery = useCallback(
    async (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) {
        const message = 'Enter a molecule name, synonym, fuzzy spelling, or PubChem CID.';
        setModeError('search', message);
        return;
      }

      clearModeError('search');
      setLoadingSearch(true);
      try {
        const cacheKey = searchCacheKey(trimmed);
        let cached = searchResultCache.current.get(cacheKey);
        if (!cached) {
          const response = await fetch(`/api/chem/pubchem/search?query=${encodeURIComponent(trimmed)}&limit=8`);
          const payload = await readApiResponse<SearchCandidate & {
            error?: string;
            result?: SearchCandidate;
            results?: SearchCandidate[];
            needsSelection?: boolean;
          }>(response, 'Search failed');
          if (!response.ok) {
            throw new Error(apiErrorMessage(payload.error, 'Search failed'));
          }

          const candidates = (payload.results?.length ? payload.results : payload.result ? [payload.result] : [payload]).filter(
            (candidate) => candidate && (candidate.smiles || candidate.canonicalSmiles || candidate.cid)
          );
          cached = {
            candidates,
            needsSelection: Boolean(payload.needsSelection)
          };
          searchResultCache.current.set(cacheKey, cached);
        }

        const { candidates, needsSelection } = cached;
        if (candidates.length === 0) {
          throw new Error('PubChem did not return a usable molecule for this query.');
        }
        if (needsSelection || candidates.length > 1) {
          setSearchCandidateState({ query: trimmed, candidates });
          toast(`${candidates.length} possible PubChem matches found. Choose one to load.`, 'info');
          return;
        }

        await loadSearchResult(candidates[0], trimmed);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Search failed';
        setModeError('search', message);
        toast(message, 'error');
      } finally {
        setLoadingSearch(false);
      }
    },
    [clearModeError, loadSearchResult, setModeError, toast]
  );

  const selectSearchCandidate = useCallback(
    async (candidate: SearchCandidate) => {
      const query = searchCandidateState?.query || candidate.name || candidate.matchedName || 'PubChem result';
      setSearchCandidateState(null);
      clearModeError('search');
      setLoadingSearch(true);
      try {
        await loadSearchResult(candidate, query);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Search failed';
        setModeError('search', message);
        toast(message, 'error');
      } finally {
        setLoadingSearch(false);
      }
    },
    [clearModeError, loadSearchResult, searchCandidateState?.query, setModeError, toast]
  );

  const loadSmiles = useCallback(
    async (value: string) => {
      await generate3DFromSmiles(value, 'smiles', {}, 'smiles');
    },
    [generate3DFromSmiles]
  );

  const loadDrawnSmiles = useCallback(
    async (value: string) => {
      await generate3DFromSmiles(value, 'draw', {}, 'draw');
    },
    [generate3DFromSmiles]
  );

  const loadUploadedFile = useCallback(
    async ({ content, format, fileName, fileSize }: UploadPayload) => {
      clearModeError('upload');
      setLoadingUpload(true);
      try {
        if (!content.trim()) {
          throw new Error('Uploaded file is empty.');
        }
        if (fileSize > 8 * 1024 * 1024) {
          throw new Error('File is too large. Please upload a structure file smaller than 8 MB.');
        }

        if (format === 'smi' || format === 'smiles' || format === 'txt') {
          const firstSmiles = content
            .split(/\r?\n/)
            .map((line) => line.trim())
            .find(Boolean)
            ?.split(/\s+/)[0];
          if (!firstSmiles) {
            throw new Error('No SMILES string found in this text file.');
          }
          await generate3DFromSmiles(firstSmiles, 'upload', { name: 'Imported SMILES', fileName }, 'upload');
          return;
        }

        if (format === 'sdf' || format === 'mol' || format === 'xyz' || format === 'pdb' || format === 'cif') {
          const structureFormat = format;
          setProperties(emptyProperties());
          setPdbMeta(undefined);
          setCurrentMolecule({
            source: 'upload',
            name: fileName,
            fileName,
            smiles: null,
            cid: null,
            structureData: content,
            structureFormat
          });
          syncViewer(content, structureFormat);
          if (structureFormat === 'pdb') {
            setRepresentation('cartoon');
          }
          toast(`${fileName} loaded.`, 'success');
          return;
        }

        throw new Error(`Unsupported file format: ${format}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'File import failed';
        setModeError('upload', message);
        toast(message, 'error');
      } finally {
        setLoadingUpload(false);
      }
    },
    [clearModeError, generate3DFromSmiles, setModeError, syncViewer, toast]
  );

  const loadPdb = useCallback(
    async (id: string) => {
      const pdbId = id.trim().toUpperCase();
      if (!/^[0-9A-Z]{4}$/.test(pdbId)) {
        const message = 'Enter a valid four-character PDB ID, such as 1CRN.';
        setModeError('pdb', message);
        return;
      }

      clearModeError('pdb');
      setLoadingPdb(true);
      setPdbMeta(undefined);
      try {
        const response = await fetch(`/api/chem/pdb/${encodeURIComponent(pdbId)}`);
        const payload = await readApiResponse<PdbRecord & { error?: string }>(response, 'PDB load failed');
        if (!response.ok) {
          throw new Error(apiErrorMessage(payload.error, 'PDB load failed'));
        }

        setProperties(emptyProperties());
        setRepresentation('cartoon');
        syncViewer(payload.data, 'pdb');
        const metadata = {
          pdbId: payload.pdbId,
          title: payload.title,
          resolution: payload.resolution,
          experimentalMethod: payload.experimentalMethod
        };
        setPdbMeta(metadata);
        setCurrentMolecule({
          source: 'pdb',
          name: payload.title || `PDB ${payload.pdbId}`,
          pdbId: payload.pdbId,
          smiles: null,
          cid: null,
          structureData: payload.data,
          structureFormat: 'pdb'
        });
        toast(`PDB ${payload.pdbId} loaded.`, 'success');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'PDB load failed';
        setModeError('pdb', message);
        toast(message, 'error');
      } finally {
        setLoadingPdb(false);
      }
    },
    [clearModeError, setModeError, syncViewer, toast]
  );

  const exportBaseName = useMemo(() => {
    const identifier = currentMolecule.pdbId
      ? `PDB_${currentMolecule.pdbId}`
      : currentMolecule.cid
        ? `CID_${currentMolecule.cid}`
        : currentMolecule.inchikey || '';
    const sourceFileBaseName = stripFileExtension(currentMolecule.fileName);
    const autoName =
      firstExportValue(currentMolecule.name, identifier, currentMolecule.smiles, smiles, sourceFileBaseName) || 'molecule';

    if (exportNameSource === 'custom') {
      return safeFileBaseName(customExportName.trim() || autoName);
    }
    if (exportNameSource === 'name') {
      return safeFileBaseName(currentMolecule.name || autoName);
    }
    if (exportNameSource === 'smiles') {
      return safeFileBaseName(currentMolecule.smiles || smiles || autoName);
    }
    if (exportNameSource === 'identifier') {
      return safeFileBaseName(identifier || autoName);
    }
    if (exportNameSource === 'source-file') {
      return safeFileBaseName(sourceFileBaseName || autoName);
    }
    return safeFileBaseName(autoName);
  }, [
    currentMolecule.cid,
    currentMolecule.fileName,
    currentMolecule.inchikey,
    currentMolecule.name,
    currentMolecule.pdbId,
    currentMolecule.smiles,
    customExportName,
    exportNameSource,
    smiles
  ]);

  const exportFile = useCallback(
    (content: string | null | undefined, format: 'smi' | StructureFormat) => {
      if (!content) {
        toast('No data available for this export format.', 'error');
        return;
      }
      const ext = format === 'smi' ? 'smi' : format;
      downloadText(fileNameForFormat(ext, exportBaseName), content, mimeForFormat(format));
    },
    [exportBaseName, toast]
  );

  const exportSmiles = useCallback(() => exportFile(smiles, 'smi'), [exportFile, smiles]);
  const exportMol = useCallback(() => exportFile(structure.data, 'mol'), [exportFile, structure.data]);
  const exportSdf = useCallback(() => exportFile(structure.data, 'sdf'), [exportFile, structure.data]);
  const exportXyz = useCallback(() => exportFile(structure.data, 'xyz'), [exportFile, structure.data]);
  const exportPdb = useCallback(() => exportFile(structure.data, 'pdb'), [exportFile, structure.data]);

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
        link.download = fileNameForFormat('png', exportBaseName);
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
  }, [exportBaseName, toast]);

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
        exportSmiles();
      }
    };
    window.addEventListener('keydown', keyDown);
    return () => window.removeEventListener('keydown', keyDown);
  }, [exportSmiles, handleRedo, handleUndo]);

  useEffect(() => {
    viewerRef.current?.setStyleConfig({
      representation: effectiveRepresentation,
      backgroundColor: background,
      showHydrogens,
      showAtomLabels
    });
    if (structure.data) {
      viewerRef.current?.loadModel(structure.data, structure.format);
    }
  }, [background, effectiveRepresentation, showAtomLabels, showHydrogens, structure.data, structure.format]);

  useEffect(() => {
    if (!allowCartoonRepresentation && representation === 'cartoon') {
      setRepresentation('ball-and-stick');
    }
  }, [allowCartoonRepresentation, representation]);

  useEffect(() => {
    if (!initialPropertiesLoaded.current && smiles && !loadingProperties) {
      initialPropertiesLoaded.current = true;
      loadProperties(smiles);
    }
  }, [loadProperties, loadingProperties, smiles]);

  const sourceLabel = useMemo(() => {
    if (currentMolecule.source === 'pdb') return currentMolecule.pdbId ? `Loaded PDB ${currentMolecule.pdbId}` : 'Protein structure workflow';
    if (currentMolecule.source === 'upload') return currentMolecule.fileName ? `Imported ${currentMolecule.fileName}` : 'Uploaded structure workflow';
    if (currentMolecule.smiles) return `Current SMILES: ${currentMolecule.smiles}`;
    return 'No structure loaded.';
  }, [currentMolecule.fileName, currentMolecule.pdbId, currentMolecule.smiles, currentMolecule.source]);

  const exportAvailability = useMemo(
    () => ({
      smiles: Boolean(smiles.trim()),
      structure: Boolean(structure.data),
      pdb: structure.format === 'pdb' && Boolean(structure.data),
      image: Boolean(structure.data)
    }),
    [smiles, structure.data, structure.format]
  );

  const globalLoading = useMemo(() => {
    if (loadingSearch) return { label: 'Searching molecule', description: 'Querying molecular records and preparing the selected structure.' };
    if (loadingPdb) return { label: 'Loading PDB structure', description: 'Fetching the structure file and metadata.' };
    if (loadingUpload) return { label: 'Loading structure file', description: 'Reading and validating the selected molecular structure.' };
    if (loading3D) return { label: 'Rendering structure', description: 'Generating the current molecular model view.' };
    if (loadingExport) return { label: 'Exporting file', description: 'Preparing the requested output file.' };
    if (detailsOpen && loadingProperties) return { label: 'Updating structure details', description: 'Calculating molecular properties for the current structure.' };
    return null;
  }, [detailsOpen, loading3D, loadingExport, loadingPdb, loadingProperties, loadingSearch, loadingUpload]);

  const toastClass = useCallback((level: Toast['level']) => {
    if (level === 'error') return 'border-rose-200 text-rose-700';
    if (level === 'success') return 'border-emerald-200 text-emerald-700';
    return 'border-sky-200 text-sky-700';
  }, []);

  return (
    <div className="h-screen overflow-hidden bg-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-3 px-3 py-3 md:flex-row md:items-center md:justify-between md:px-4">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-2 text-base font-bold tracking-tight text-slate-950">
              <Image
                src="/brand/chemvault-logo.png"
                alt="ChemVault logo"
                width={32}
                height={32}
                priority
                unoptimized
                className="h-8 w-8 rounded-md object-contain"
              />
              <span>ChemVault</span>
            </a>
            <span className="h-5 w-px bg-slate-200" />
            <span className="text-sm font-medium text-slate-600">Molecule Studio</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="hidden rounded-md border border-slate-200 bg-slate-50 px-2 py-1 sm:inline-flex">2D editor</span>
            <span className="hidden rounded-md border border-slate-200 bg-slate-50 px-2 py-1 sm:inline-flex">3D viewer</span>
            <span className="hidden rounded-md border border-slate-200 bg-slate-50 px-2 py-1 lg:inline-flex">PubChem / PDB</span>
            <AuthButton />
          </div>
        </div>
      </header>

      <main className="mx-auto flex h-[calc(100vh-61px)] max-w-[1800px] flex-col px-3 py-3 md:px-4">
        <section className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <MoleculeModeTabs activeMode={activeMode} onChange={setActiveMode} />
          <div className="overflow-x-auto">
            <ExportPanel
              available={exportAvailability}
              customName={customExportName}
              namePreview={exportBaseName}
              nameSource={exportNameSource}
              loadingExport={loadingExport}
              onCustomNameChange={setCustomExportName}
              onExportSmiles={exportSmiles}
              onExportMol={exportMol}
              onExportSdf={exportSdf}
              onExportXyz={exportXyz}
              onExportPdb={exportPdb}
              onExportPng={exportPng}
              onNameSourceChange={setExportNameSource}
            />
          </div>
        </section>

        <section className="mt-3 grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(430px,0.95fr)_minmax(0,1.05fr)]">
          <div className="min-h-0 animate-fade overflow-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h1 className="text-sm font-semibold text-slate-950">2D Input Workspace</h1>
                <p className="mt-1 text-xs text-slate-500">Choose a workflow, then send the structure to the 3D viewer.</p>
              </div>
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium capitalize text-slate-600">{activeMode}</span>
            </div>
            {activeMode === 'search' ? <SearchMode onSearch={loadByQuery} loading={loadingSearch} error={modeErrors.search} /> : null}
            {activeMode === 'smiles' ? (
              <SmilesMode
                value={smiles}
                onValueChange={updateSmilesDraft}
                onLoad={loadSmiles}
                onClear={clearStudio}
                onCopy={(value) => navigator.clipboard?.writeText(value).catch(() => {})}
                loading={loading3D}
                error={modeErrors.smiles}
              />
            ) : null}
            {activeMode === 'draw' ? (
              <DrawMode
                value={smiles}
                onValueChange={updateSmilesDraft}
                onGenerate3D={loadDrawnSmiles}
                onUndo={handleUndo}
                onRedo={handleRedo}
                onClear={clearStudio}
                loading={loading3D}
                error={modeErrors.draw}
              />
            ) : null}
            {activeMode === 'upload' ? <UploadMode onLoadFile={loadUploadedFile} loading={loadingUpload || loading3D} error={modeErrors.upload} /> : null}
            {activeMode === 'pdb' ? <PdbMode onLoadPdb={loadPdb} loading={loadingPdb} error={modeErrors.pdb} metadata={pdbMeta} /> : null}
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-950">3D Output Workspace</h2>
                <p className="mt-1 text-xs text-slate-500">Inspect geometry, properties, display settings, and exports.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDetailsOpen(true)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-sky-300 hover:text-sky-800"
                >
                  Structure Details
                </button>
                <span className={`rounded-md px-2 py-1 text-xs font-medium ${structure.data ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {structure.data ? 'Loaded' : 'Empty'}
                </span>
              </div>
            </div>
            <div className="mt-3 min-h-0 flex-1">
              <ViewerPanel
                ref={viewerRef}
                loading={loading3D || loadingSearch || loadingPdb || loadingUpload}
                hasStructure={Boolean(structure.data)}
                sourceLabel={sourceLabel}
                initialRepresentation={effectiveRepresentation}
                onReady={() => {
                  if (structure.data) {
                    viewerRef.current?.loadModel(structure.data, structure.format);
                  }
                }}
              >
                <DisplayControls
                  representation={representation}
                  background={background}
                  showHydrogens={showHydrogens}
                  showAtomLabels={showAtomLabels}
                  allowCartoonRepresentation={allowCartoonRepresentation}
                  onRepresentationChange={setRepresentation}
                  onBackgroundChange={setBackground}
                  onToggleHydrogens={() => setShowHydrogens((value) => !value)}
                  onToggleAtomLabels={() => setShowAtomLabels((value) => !value)}
                  onResetView={() => viewerRef.current?.resetView()}
                />
              </ViewerPanel>
            </div>
          </div>
        </section>
      </main>

      {detailsOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Structure Details</h2>
                <p className="mt-1 text-xs text-slate-500">Identifiers, properties, and copied notations for the current structure.</p>
              </div>
              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                className="shrink-0 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto p-4">
              <MoleculePropertiesPanel
                metadata={currentMolecule}
                properties={properties}
                loading={loadingProperties}
                onCopy={(value) => navigator.clipboard?.writeText(value).catch(() => {})}
              />
            </div>
          </div>
        </div>
      ) : null}

      {searchCandidateState ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="search-candidates-title">
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 id="search-candidates-title" className="text-lg font-bold text-slate-950">Choose a PubChem compound</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Search is now tolerant of aliases and close spellings. Select the exact substance for{' '}
                  <span className="font-semibold text-slate-800">{searchCandidateState.query}</span>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSearchCandidateState(null)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto p-4">
              <div className="grid gap-3">
                {searchCandidateState.candidates.map((candidate, index) => (
                  <button
                    key={`${candidate.cid || candidate.inchikey || candidate.name || index}-${index}`}
                    type="button"
                    onClick={() => selectSearchCandidate(candidate)}
                    disabled={loadingSearch}
                    className="group rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-bold text-slate-950">{candidate.name || candidate.matchedName || `CID ${candidate.cid}`}</h3>
                          {candidate.matchType ? (
                            <span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-700">{matchTypeLabel(candidate.matchType)}</span>
                          ) : null}
                        </div>
                        {candidate.iupacName && candidate.iupacName !== candidate.name ? (
                          <p className="mt-1 line-clamp-2 text-sm text-slate-600">{candidate.iupacName}</p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                          {candidate.cid ? <span className="rounded-md bg-slate-100 px-2 py-1">CID {candidate.cid}</span> : null}
                          {candidate.formula ? <span className="rounded-md bg-slate-100 px-2 py-1">{candidate.formula}</span> : null}
                          {candidate.molecularWeight ? <span className="rounded-md bg-slate-100 px-2 py-1">{candidate.molecularWeight.toFixed(2)} g/mol</span> : null}
                          {candidate.matchScore ? <span className="rounded-md bg-slate-100 px-2 py-1">{Math.round(candidate.matchScore * 100)}% match</span> : null}
                        </div>
                      </div>
                      <span className="rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white group-hover:bg-sky-700">
                        Load
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-2 md:right-6">
        {toastMessages.map((item) => (
          <div key={item.id} className={`toast pointer-events-auto max-w-[min(80vw,360px)] border ${toastClass(item.level)} bg-white/95`}>
            <span>{item.text}</span>
          </div>
        ))}
      </div>

      <GlobalLoadingOverlay
        visible={Boolean(globalLoading)}
        label={globalLoading?.label || 'Loading'}
        description={globalLoading?.description}
      />
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

function firstExportValue(...values: Array<string | null | undefined>) {
  return values.find((value) => Boolean(value?.trim()))?.trim() || '';
}

function stripFileExtension(value?: string | null) {
  return value?.replace(/\.[a-zA-Z0-9]{1,8}$/u, '') || '';
}

async function readApiResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const text = await response.text();
  if (!text.trim()) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    const normalized = text.trim().slice(0, 240);
    if (/fetch failed|network|failed to fetch|ECONNRESET|ENOTFOUND|ETIMEDOUT/iu.test(normalized)) {
      throw new Error('Cannot reach the ChemVault chemistry service. Check the network connection and try again.');
    }
    throw new Error(`${fallbackMessage}. The service returned an invalid response.`);
  }
}

function apiErrorMessage(value: string | undefined, fallbackMessage: string) {
  const message = value?.trim() || fallbackMessage;
  if (/fetch failed|network|failed to fetch|ECONNRESET|ENOTFOUND|ETIMEDOUT|CHEM_API_PROXY_FAILED/iu.test(message)) {
    return 'Cannot reach the ChemVault chemistry service. Check the network connection and try again.';
  }
  return message;
}

function searchCacheKey(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

function matchTypeLabel(type: SearchCandidate['matchType']) {
  if (type === 'cid') return 'CID';
  if (type === 'inchikey') return 'InChIKey';
  if (type === 'smiles') return 'SMILES';
  if (type === 'autocomplete') return 'Suggested';
  if (type === 'normalized-name') return 'Fuzzy';
  return 'Name match';
}
