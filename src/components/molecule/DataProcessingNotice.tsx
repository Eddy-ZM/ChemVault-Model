export function DataProcessingNotice() {
  return (
    <details className="mt-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
      <summary className="cursor-pointer font-semibold text-slate-800">Data handling: local and cloud operations</summary>
      <div className="mt-2 grid gap-2 leading-5 md:grid-cols-2">
        <p><span className="font-semibold text-emerald-800">Local:</span> desktop quantum jobs and locally opened structure files remain on this computer.</p>
        <p><span className="font-semibold text-sky-800">Cloud:</span> PubChem/PDB lookup, property calculation, and 3D generation use ChemVault web services.</p>
      </div>
      <p className="mt-2 border-t border-slate-200 pt-2 text-slate-700">
        Do not send confidential structures to cloud operations unless your organization permits it.
      </p>
    </details>
  );
}
