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
    <section className="rounded-[2rem] border border-slate-200 bg-white/95 p-4 shadow-card">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">3D Viewer</h2>
          <p className="mt-1 text-sm text-slate-600">{sourceLabel || 'Load a molecule to start visualisation.'}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${hasStructure ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          {hasStructure ? 'Structure loaded' : 'No structure yet'}
        </span>
      </div>

      <MoleculeViewer3D ref={ref} loading={loading} initialRepresentation={initialRepresentation} onReady={onReady} showHeader={false} />
      {children ? <div className="mt-4 space-y-4">{children}</div> : null}
    </section>
  );
});

ViewerPanel.displayName = 'ViewerPanel';
