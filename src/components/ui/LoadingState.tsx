import type { ReactNode } from 'react';

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';

const spinnerSizes: Record<SpinnerSize, string> = {
  xs: 'cv-engine-spinner-xs',
  sm: 'cv-engine-spinner-sm',
  md: 'cv-engine-spinner-md',
  lg: 'cv-engine-spinner-lg'
};

export function EngineSpinner({
  className = '',
  decorative = false,
  label = 'Loading',
  size = 'md'
}: {
  className?: string;
  decorative?: boolean;
  label?: string;
  size?: SpinnerSize;
}) {
  return (
    <span
      className={`cv-engine-spinner ${spinnerSizes[size]} ${className}`.trim()}
      {...(decorative ? { 'aria-hidden': true } : { role: 'status', 'aria-label': label })}
    >
      <span />
      <span />
      <span />
    </span>
  );
}

export function LoadingState({
  children,
  className = '',
  compact = false,
  description,
  label = 'Loading',
  size,
  tone = 'neutral'
}: {
  children?: ReactNode;
  className?: string;
  compact?: boolean;
  description?: string;
  label?: string;
  size?: SpinnerSize;
  tone?: 'neutral' | 'panel' | 'overlay';
}) {
  const toneClass =
    tone === 'overlay'
      ? 'rounded-full border border-sky-100 bg-white/95 px-4 py-2 shadow-sm'
      : tone === 'panel'
        ? 'rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3'
        : '';
  const layoutClass = compact ? 'flex items-center gap-3' : 'flex flex-col items-center justify-center gap-3 text-center';
  const resolvedSize = size || (compact ? 'sm' : 'md');

  return (
    <div className={`${layoutClass} ${toneClass} ${className}`.trim()} role="status" aria-live="polite">
      <EngineSpinner size={resolvedSize} decorative />
      <div className={compact ? 'min-w-0' : 'max-w-md'}>
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        {description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}
        {children}
      </div>
    </div>
  );
}

export function GlobalLoadingOverlay({
  description,
  label,
  visible
}: {
  description?: string;
  label: string;
  visible: boolean;
}) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[1200] grid place-items-center bg-slate-950/25 px-4 backdrop-blur-[2px]" aria-live="polite">
      <div className="rounded-2xl border border-slate-200 bg-white/95 px-8 py-7 shadow-2xl">
        <LoadingState label={label} description={description} />
      </div>
    </div>
  );
}
