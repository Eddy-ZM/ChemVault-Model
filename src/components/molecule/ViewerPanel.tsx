'use client';

import { ForwardedRef, ReactNode, forwardRef } from 'react';
import { MoleculeViewer3D, MoleculeViewerHandle } from '@/components/molecule/MoleculeViewer3D';
import { Representation } from '@/components/molecule/DisplayControls';

type Props = {
  loading?: boolean;
  hasStructure?: boolean;
  sourceLabel?: string;
  initialRepresentation: Representation;
  onReady?: () => void;
  children?: ReactNode;
};

export const ViewerPanel = forwardRef(function ViewerPanel(
  { loading, hasStructure, sourceLabel, initialRepresentation, onReady, children }: Props,
  ref: ForwardedRef<MoleculeViewerHandle>
) {
  return (
    <section className="flex h-full min-h-0 flex-col rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-4 flex shrink-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-slate-950">3D Viewer</h2>
          <p className="mt-1 text-sm text-slate-600">{sourceLabel || 'Load a molecule to start visualisation.'}</p>
        </div>
        <div className="flex min-w-0 flex-col items-start gap-2 lg:items-end">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${hasStructure ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            {hasStructure ? 'Structure loaded' : 'No structure yet'}
          </span>
          {children}
        </div>
      </div>

      <MoleculeViewer3D ref={ref} loading={loading} initialRepresentation={initialRepresentation} onReady={onReady} showHeader={false} />
    </section>
  );
});

ViewerPanel.displayName = 'ViewerPanel';
