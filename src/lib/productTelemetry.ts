const TELEMETRY_KEY = 'chemvault.model.productDiagnostics.v1';

export type ProductEventName =
  | 'molecule_search_completed'
  | 'molecule_search_failed'
  | 'structure_generation_completed'
  | 'structure_generation_failed'
  | 'quantum_calculation_completed'
  | 'quantum_calculation_failed'
  | 'export_completed';

const EVENT_NAMES = new Set<ProductEventName>([
  'molecule_search_completed',
  'molecule_search_failed',
  'structure_generation_completed',
  'structure_generation_failed',
  'quantum_calculation_completed',
  'quantum_calculation_failed',
  'export_completed'
]);
const ATTRIBUTE_KEYS = new Set(['source', 'engine', 'task', 'status', 'duration', 'atomBand', 'format', 'cached']);

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

export async function trackProductEvent(name: ProductEventName, attributes: Record<string, unknown> = {}) {
  if (!isProductTelemetryEnabled() || !EVENT_NAMES.has(name)) return;
  const safeAttributes = Object.fromEntries(
    Object.entries(attributes)
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
