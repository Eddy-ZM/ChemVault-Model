const TELEMETRY_KEY = 'chemvault.model.productDiagnostics.v1';

export type ProductEventName =
  | 'molecule_search_completed'
  | 'molecule_search_failed'
  | 'structure_generation_completed'
  | 'structure_generation_failed'
  | 'quantum_calculation_started'
  | 'quantum_calculation_completed'
  | 'quantum_calculation_failed'
  | 'quantum_result_available'
  | 'export_completed';

const EVENT_NAMES = new Set<ProductEventName>([
  'molecule_search_completed',
  'molecule_search_failed',
  'structure_generation_completed',
  'structure_generation_failed',
  'quantum_calculation_started',
  'quantum_calculation_completed',
  'quantum_calculation_failed',
  'quantum_result_available',
  'export_completed'
]);
const ATTRIBUTE_KEYS = new Set(['source', 'engine', 'task', 'status', 'duration', 'atomBand', 'format', 'cached', 'version', 'platform', 'journey', 'firstRun']);
const JOURNEY_KEY = 'chemvault.model.productJourney.v1';
const FIRST_CALCULATION_KEY = 'chemvault.model.firstCalculationStarted.v1';

export function isProductTelemetryEnabled() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(TELEMETRY_KEY) === 'enabled';
}

export function setProductTelemetryEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TELEMETRY_KEY, enabled ? 'enabled' : 'disabled');
}

export function durationBucket(milliseconds: number) {
  if (milliseconds < 1000) return '<1s';
  if (milliseconds < 5000) return '1-5s';
  if (milliseconds < 30000) return '5-30s';
  if (milliseconds < 120000) return '30-120s';
  return '>120s';
}

export function beginQuantumCalculationJourney() {
  if (typeof window === 'undefined') return { firstRun: false };
  const firstRun = window.localStorage.getItem(FIRST_CALCULATION_KEY) !== 'yes';
  window.localStorage.setItem(FIRST_CALCULATION_KEY, 'yes');
  return { firstRun };
}

export async function trackProductEvent(name: ProductEventName, attributes: Record<string, unknown> = {}) {
  if (!isProductTelemetryEnabled() || !EVENT_NAMES.has(name)) return;
  const enrichedAttributes = {
    ...attributes,
    version: packageInfo.version,
    platform: window.chemVaultDesktop?.isDesktop ? 'windows' : 'web',
    journey: productJourneyId()
  };
  const safeAttributes = Object.fromEntries(
    Object.entries(enrichedAttributes)
      .filter(([key, value]) => ATTRIBUTE_KEYS.has(key) && ['string', 'number', 'boolean'].includes(typeof value))
      .map(([key, value]) => [key, String(value).slice(0, 60)])
  );
  await fetch('/api/product-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, attributes: safeAttributes }),
    keepalive: true
  }).catch(() => undefined);
}

function productJourneyId() {
  const existing = window.sessionStorage.getItem(JOURNEY_KEY);
  if (existing) return existing;
  const next = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `journey_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  window.sessionStorage.setItem(JOURNEY_KEY, next);
  return next;
}
import packageInfo from '../../package.json';
