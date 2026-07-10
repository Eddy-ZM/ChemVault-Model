import type { QuantumResultDiagnosis } from '@/lib/chem/quantumWorkflow';

export function QuantumResultDiagnosisPanel({
  diagnosis,
  onApplyRouteFix
}: {
  diagnosis: QuantumResultDiagnosis;
  onApplyRouteFix?: (routeOption: string, label: string, rerun?: boolean) => void;
}) {
  const tone = diagnosis.severity === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : diagnosis.severity === 'error'
      ? 'border-rose-200 bg-rose-50 text-rose-800'
      : 'border-amber-200 bg-amber-50 text-amber-800';

  return (
    <section className={`rounded-2xl border px-4 py-3 ${tone}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">ChemVault review</p>
          <h4 className="mt-1 text-sm font-bold">{diagnosis.title}</h4>
          <p className="mt-1 text-xs leading-5">{diagnosis.summary}</p>
        </div>
        {typeof diagnosis.completenessScore === 'number' ? (
          <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold">
            Result completeness {diagnosis.completenessScore}/100
          </span>
        ) : null}
      </div>
      {diagnosis.completenessFactors?.length ? (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {diagnosis.completenessFactors.slice(0, 4).map((factor) => (
            <p key={factor} className="rounded-xl bg-white/70 px-3 py-2 text-xs leading-5">{factor}</p>
          ))}
        </div>
      ) : null}
      <p className="mt-3 text-xs leading-5 opacity-80">
        Result completeness reflects parsed output coverage and termination checks, not the scientific accuracy of the selected method.
      </p>
      {diagnosis.suggestedActions.length > 0 ? (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {diagnosis.suggestedActions.slice(0, 4).map((action) => (
            <p key={action} className="rounded-xl bg-white/70 px-3 py-2 text-xs leading-5">{action}</p>
          ))}
        </div>
      ) : null}
      {onApplyRouteFix && diagnosis.routeFixes?.length ? (
        <div className="mt-3 rounded-xl bg-white/70 px-3 py-3">
          <p className="text-xs font-bold">Route repair options</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {diagnosis.routeFixes.map((fix) => (
              <span key={`${fix.label}-${fix.routeOption}`} className="inline-flex overflow-hidden rounded-xl border border-slate-300 bg-white">
                <button
                  type="button"
                  onClick={() => onApplyRouteFix(fix.routeOption, fix.label)}
                  title={fix.detail}
                  className="px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  {fix.label}
                </button>
                <button
                  type="button"
                  onClick={() => onApplyRouteFix(fix.routeOption, fix.label, true)}
                  title={`${fix.detail} Then rerun Gaussian.`}
                  className="border-l border-slate-300 px-3 py-2 text-xs font-semibold text-sky-800 hover:bg-sky-50"
                >
                  Apply & rerun
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {diagnosis.highlights.length > 0 ? (
        <details className="mt-3 rounded-xl bg-white/70 px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold">Parsed log highlights</summary>
          <div className="mt-2 space-y-1">
            {diagnosis.highlights.map((line) => (
              <p key={line} className="font-mono text-[11px] leading-5">{line}</p>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
