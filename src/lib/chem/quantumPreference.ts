import type { QuantumEngineKind } from '@/lib/chem/quantumTypes';

const PREFERENCE_KEY = 'chemvault.model.preferredQuantumEngine';
const NOTICE_KEY = 'chemvault.model.quantumEngineNotice';

export type QuantumEnginePreference = {
  engine: QuantumEngineKind;
  label: string;
  savedAt: string;
  source: 'studio' | 'welcome';
};

export function saveQuantumEnginePreference(
  engine: QuantumEngineKind,
  label: string,
  options: { notifyInStudio?: boolean; source?: QuantumEnginePreference['source'] } = {}
) {
  if (typeof window === 'undefined') return;

  const preference: QuantumEnginePreference = {
    engine,
    label,
    savedAt: new Date().toISOString(),
    source: options.source || 'studio'
  };

  try {
    window.localStorage.setItem(PREFERENCE_KEY, JSON.stringify(preference));
    if (options.notifyInStudio) {
      window.sessionStorage.setItem(NOTICE_KEY, JSON.stringify(preference));
    }
  } catch {
    // Preference persistence is a convenience layer; engine configuration remains saved by the desktop bridge.
  }
}

export function loadQuantumEnginePreference() {
  if (typeof window === 'undefined') return null;
  return readPreference(window.localStorage.getItem(PREFERENCE_KEY));
}

export function consumeQuantumEnginePreferenceNotice() {
  if (typeof window === 'undefined') return null;

  try {
    const preference = readPreference(window.sessionStorage.getItem(NOTICE_KEY));
    window.sessionStorage.removeItem(NOTICE_KEY);
    return preference;
  } catch {
    return null;
  }
}

function readPreference(value: string | null): QuantumEnginePreference | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<QuantumEnginePreference>;
    if (!isQuantumEngineKind(parsed.engine) || !parsed.label) return null;
    return {
      engine: parsed.engine,
      label: String(parsed.label),
      savedAt: String(parsed.savedAt || ''),
      source: parsed.source === 'welcome' ? 'welcome' : 'studio'
    };
  } catch {
    return null;
  }
}

function isQuantumEngineKind(value: unknown): value is QuantumEngineKind {
  return value === 'xtb' || value === 'pyscf' || value === 'gaussian' || value === 'orca';
}
