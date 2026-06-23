'use client';

import { ChangeEvent, DragEvent, useMemo, useRef, useState } from 'react';
import { FileFormat, inferFormatFromFilename } from '@/lib/chem/fileExport';

export type UploadPayload = {
  content: string;
  format: FileFormat;
  fileName: string;
  fileSize: number;
};

type Props = {
  onLoadFile: (payload: UploadPayload) => Promise<void>;
  loading?: boolean;
  error?: string | null;
};

const SUPPORTED_FORMATS = ['.mol', '.sdf', '.xyz', '.pdb', '.cif', '.smi', '.smiles', '.txt'];
const MAX_FILE_SIZE = 8 * 1024 * 1024;

export function UploadMode({ onLoadFile, loading, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const fileFormat = useMemo(() => (selectedFile ? inferFormatFromFilename(selectedFile.name) : null), [selectedFile]);

  const chooseFile = (file: File | null) => {
    setLocalError(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setSelectedFile(null);
      setLocalError('File is too large. Please upload a structure file smaller than 8 MB.');
      return;
    }
    const extension = `.${file.name.split('.').pop()?.toLowerCase() || ''}`;
    if (!SUPPORTED_FORMATS.includes(extension)) {
      setSelectedFile(null);
      setLocalError(`Unsupported file format: ${extension || 'unknown'}.`);
      return;
    }
    setSelectedFile(file);
  };

  const onFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    chooseFile(event.target.files?.[0] ?? null);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files?.[0] ?? null);
  };

  const loadFile = async () => {
    if (!selectedFile) {
      setLocalError('Choose a structure file before loading.');
      return;
    }
    const content = await selectedFile.text();
    await onLoadFile({ content, format: inferFormatFromFilename(selectedFile.name), fileName: selectedFile.name, fileSize: selectedFile.size });
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-card">
      <div className="max-w-3xl">
        <h2 className="text-2xl font-bold text-slate-950">Upload Structure File</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Import molecular structure files and visualise them in 3D.</p>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_280px]">
        <div
          onDrop={onDrop}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          className={`flex min-h-64 flex-col items-center justify-center rounded-3xl border-2 border-dashed p-8 text-center transition ${
            dragging ? 'border-sky-500 bg-sky-50' : 'border-slate-300 bg-slate-50'
          }`}
        >
          <p className="text-lg font-semibold text-slate-950">Drag and drop a structure file</p>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">Supported formats: {SUPPORTED_FORMATS.join(', ')}</p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-5 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Choose File
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".mol,.sdf,.xyz,.pdb,.cif,.smi,.smiles,.txt"
            onChange={onFileInput}
            className="sr-only"
          />
        </div>

        <aside className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-800">Current file</p>
          {selectedFile ? (
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <p className="break-all font-semibold text-slate-950">{selectedFile.name}</p>
              <p>Size: {(selectedFile.size / 1024).toFixed(1)} KB</p>
              <p>Format: {fileFormat?.toUpperCase()}</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No file selected.</p>
          )}

          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={loadFile}
              disabled={!selectedFile || loading}
              className="rounded-2xl bg-sky-700 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Loading file...' : 'Load File'}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedFile(null);
                setLocalError(null);
                if (inputRef.current) inputRef.current.value = '';
              }}
              className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-white"
            >
              Clear File
            </button>
          </div>
        </aside>
      </div>

      {localError || error ? (
        <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{localError || error}</p>
      ) : null}
    </section>
  );
}
