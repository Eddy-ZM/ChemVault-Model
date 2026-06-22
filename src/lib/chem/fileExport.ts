export function downloadText(name: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export type FileFormat = 'sdf' | 'mol' | 'xyz' | 'pdb' | 'cif' | 'smi' | 'smiles' | 'txt';

export function inferFormatFromFilename(name: string): FileFormat {
  const extension = name.split('.').pop()?.toLowerCase();
  if (!extension) return 'sdf';
  if (extension === 'mol') return 'mol';
  if (extension === 'xyz') return 'xyz';
  if (extension === 'pdb') return 'pdb';
  if (extension === 'cif') return 'cif';
  if (extension === 'smi' || extension === 'smiles' || extension === 'txt') return 'smi';
  return 'sdf';
}

export function fileNameForFormat(format: 'sdf' | 'mol' | 'xyz' | 'pdb' | 'cif' | 'smi', smiles = 'molecule') {
  const base = smiles.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 48) || 'molecule';
  return `${base}.${format === 'smi' ? 'smi' : format}`;
}
