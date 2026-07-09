'use client';

import { useEffect, useState } from 'react';
import { LoadingState } from '@/components/ui/LoadingState';

const DEFER_UNTIL_KEY = 'chemvault.desktop.update.deferUntil';
const DEFER_PAIR_KEY = 'chemvault.desktop.update.deferPair';
const MIN_CHECK_INTERVAL_MS = 60_000;

export function DesktopUpdateGate() {
  const [status, setStatus] = useState<DesktopVersionStatus | null>(null);
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const api = window.chemVaultDesktop;
    if (!api?.isDesktop || !api.getVersionStatus) return;
    const getVersionStatus = api.getVersionStatus;

    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function checkVersion(scheduleNext = true) {
      setChecking(true);
      try {
        const nextStatus = await getVersionStatus();
        if (disposed) return;
        setStatus(nextStatus);
        setVisible(shouldShowGate(nextStatus));

        if (scheduleNext) {
          const interval = Math.max(MIN_CHECK_INTERVAL_MS, Number(nextStatus.checkIntervalSeconds || 300) * 1000);
          timer = setTimeout(() => {
            void checkVersion(true);
          }, interval);
        }
      } catch {
        if (!disposed && scheduleNext) {
          timer = setTimeout(() => {
            void checkVersion(true);
          }, 300_000);
        }
      } finally {
        if (!disposed) setChecking(false);
      }
    }

    function recheckNow() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      void checkVersion(true);
    }

    void checkVersion(true);
    window.addEventListener('focus', recheckNow);
    window.addEventListener('online', recheckNow);
    document.addEventListener('visibilitychange', recheckNow);

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener('focus', recheckNow);
      window.removeEventListener('online', recheckNow);
      document.removeEventListener('visibilitychange', recheckNow);
    };
  }, []);

  if (!status || !visible || !status.updateAvailable) return null;

  const required = status.updateRequired;
  const deferralHours = Math.max(1, Math.min(168, Number(status.deferralHours) || 24));

  async function openUpdate() {
    const api = window.chemVaultDesktop;
    if (api?.openUpdateUrl) {
      await api.openUpdateUrl(status?.downloadUrl);
      return;
    }

    if (status?.downloadUrl) {
      window.open(status.downloadUrl, '_blank', 'noopener,noreferrer');
    }
  }

  function deferUpdate() {
    if (!status?.canDefer) return;
    const deferUntil = Date.now() + deferralHours * 60 * 60 * 1000;
    window.localStorage.setItem(DEFER_UNTIL_KEY, String(deferUntil));
    window.localStorage.setItem(DEFER_PAIR_KEY, updatePair(status));
    setVisible(false);
  }

  async function recheck() {
    const api = window.chemVaultDesktop;
    if (!api?.getVersionStatus) return;
    setChecking(true);
    try {
      const nextStatus = await api.getVersionStatus();
      setStatus(nextStatus);
      setVisible(shouldShowGate(nextStatus));
    } finally {
      setChecking(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="desktop-update-title"
    >
      <section
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
        data-current-version={status.currentVersion}
        data-current-build={status.currentBuildId}
        data-latest-version={status.latestVersion}
        data-minimum-version={status.minimumSupportedVersion}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
              ChemVault Model
            </p>
            <h2 id="desktop-update-title" className="mt-2 text-2xl font-bold text-slate-950">
              {required ? 'Update required' : 'Update available'}
            </h2>
          </div>
          <span className={required ? 'rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700' : 'rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-700'}>
            {required ? 'Required' : 'Recommended'}
          </span>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-700">
          {status.message}
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {required
            ? 'This desktop build is below the supported release line. Update before continuing.'
            : `You can continue briefly, but this device will be asked again after ${deferralHours} hours.`}
        </p>

        <div className="mt-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-2">
          <p>
            <span className="block font-semibold uppercase tracking-[0.12em] text-slate-400">Current</span>
            <span className="mt-1 block font-mono text-slate-800">{status.currentVersion}</span>
            {status.currentBuildId ? <span className="mt-1 block break-all font-mono text-[11px]">{status.currentBuildId}</span> : null}
          </p>
          <p>
            <span className="block font-semibold uppercase tracking-[0.12em] text-slate-400">Latest</span>
            <span className="mt-1 block font-mono text-slate-800">{status.latestVersion}</span>
            {status.latestBuildId ? <span className="mt-1 block break-all font-mono text-[11px]">{status.latestBuildId}</span> : null}
          </p>
        </div>

        {checking ? (
          <LoadingState
            compact
            tone="panel"
            className="mt-4"
            label="Checking release status"
            description="Comparing this build with the current ChemVault Model release."
          />
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          {status.canDefer ? (
            <button
              type="button"
              onClick={deferUpdate}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Continue briefly
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void recheck()}
            disabled={checking}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {checking ? 'Checking' : 'Check again'}
          </button>
          {status.releaseNotesUrl ? (
            <button
              type="button"
              onClick={() => window.open(status.releaseNotesUrl, '_blank', 'noopener,noreferrer')}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Release notes
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void openUpdate()}
            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Update now
          </button>
        </div>
      </section>
    </div>
  );
}

function shouldShowGate(status: DesktopVersionStatus) {
  if (!status.updateAvailable) return false;
  if (status.updateRequired) return true;
  if (!status.canDefer) return true;
  return !isDeferred(status);
}

function isDeferred(status: DesktopVersionStatus) {
  if (typeof window === 'undefined') return false;
  const deferUntil = Number(window.localStorage.getItem(DEFER_UNTIL_KEY));
  const pair = window.localStorage.getItem(DEFER_PAIR_KEY);
  return pair === updatePair(status) && Number.isFinite(deferUntil) && deferUntil > Date.now();
}

function updatePair(status: DesktopVersionStatus) {
  return `${status.currentVersion}->${status.latestVersion}`;
}
