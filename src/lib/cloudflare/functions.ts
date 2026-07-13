export type CloudflareChemEnv = {
  MOLECULE_API_URL?: string;
  NEXT_PUBLIC_MOLECULE_API_URL?: string;
  VITE_MOLECULE_API_URL?: string;
  QUANTUM_API_URL?: string;
  CHEMVAULT_QUANTUM_API_URL?: string;
  QUANTUM_API_TOKEN?: string;
  CHEMVAULT_QUANTUM_API_TOKEN?: string;
  CHEMVAULT_USER_ORIGIN?: string;
  CHEMVAULT_ALLOWED_ORIGINS?: string;
  APP_ENV?: string;
  BILLING_API_ORIGIN?: string;
  BILLING_SERVICE_SECRET?: string;
  BILLING_ENFORCEMENT_MODE?: string;
  CHEMVAULT_METRICS_TOKEN?: string;
  SYNTHETIC_MONITOR_SECRET?: string;
  RATE_LIMIT_KV?: CloudflareKvNamespace;
};

export type CloudflareKvNamespace = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  list(options?: { prefix?: string; cursor?: string; limit?: number }): Promise<{
    keys: Array<{ name: string }>;
    list_complete: boolean;
    cursor?: string;
  }>;
};

export type ProductFunnelReport = {
  days: number;
  generatedAt: string;
  journeys: number;
  scan: {
    rows: number;
    rowLimit: number;
    truncated: boolean;
  };
  sample: {
    minimumJourneys: number;
    sufficient: boolean;
  };
  counts: {
    calculationStarted: number;
    resultAvailable: number;
    calculationCompleted: number;
    calculationFailed: number;
    exportCompleted: number;
  };
  rates: {
    completionAfterStart: number | null;
    exportAfterResult: number | null;
    firstRunCompletion: number | null;
  };
};

const PRODUCT_FUNNEL_ROW_LIMIT = 20_000;
const PRODUCT_FUNNEL_READ_BATCH = 100;
const PRODUCT_FUNNEL_MINIMUM_JOURNEYS = 30;

export type CloudflarePagesContext<Params extends Record<string, string | string[] | undefined> = Record<string, string | string[] | undefined>> = {
  request: Request;
  env: CloudflareChemEnv;
  params: Params;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export function jsonResponse(payload: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders,
      ...headers
    }
  });
}

export function optionsResponse(headers: HeadersInit = corsHeaders) {
  return new Response(null, {
    status: 204,
    headers
  });
}

export function readStringParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export function moleculeBackendUrl(env: CloudflareChemEnv) {
  return env.MOLECULE_API_URL || env.NEXT_PUBLIC_MOLECULE_API_URL || env.VITE_MOLECULE_API_URL || '';
}

export function quantumBackendUrl(env: CloudflareChemEnv) {
  return env.QUANTUM_API_URL || env.CHEMVAULT_QUANTUM_API_URL || '';
}

export function quantumBackendToken(env: CloudflareChemEnv) {
  return env.QUANTUM_API_TOKEN || env.CHEMVAULT_QUANTUM_API_TOKEN || '';
}

export async function consumeRateLimit(env: CloudflareChemEnv, key: string, limit: number, periodSeconds = 60) {
  if (!env.RATE_LIMIT_KV) return { configured: false as const, success: false as const, unavailable: false as const };
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
    const keyHash = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
    const windowId = Math.floor(Date.now() / (periodSeconds * 1000));
    const storageKey = `rate:${windowId}:${keyHash}`;
    const current = Number.parseInt((await env.RATE_LIMIT_KV.get(storageKey)) || '0', 10) || 0;
    if (current >= limit) return { configured: true as const, success: false as const, unavailable: false as const };
    await env.RATE_LIMIT_KV.put(storageKey, String(current + 1), {
      expirationTtl: Math.max(60, periodSeconds * 2)
    });
    return { configured: true as const, success: true as const, unavailable: false as const };
  } catch {
    return { configured: true as const, success: false as const, unavailable: true as const };
  }
}

export async function recordProductEvent(env: CloudflareChemEnv, name: string, attributes: Record<string, string>) {
  if (!env.RATE_LIMIT_KV) return false;
  try {
    const journey = normalizeJourney(attributes.journey);
    const aggregateAttributes = Object.fromEntries(
      Object.entries(attributes)
        .filter(([key]) => key !== 'journey')
        .sort(([left], [right]) => left.localeCompare(right))
    );
    const dimensions = JSON.stringify(aggregateAttributes);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(dimensions));
    const dimensionHash = [...new Uint8Array(digest)].slice(0, 8).map((value) => value.toString(16).padStart(2, '0')).join('');
    const day = new Date().toISOString().slice(0, 10);
    const key = `event-aggregate:${day}:${name}:${dimensionHash}`;
    const previous = await env.RATE_LIMIT_KV.get(key);
    const current = previous ? JSON.parse(previous) as { count?: number } : {};
    await env.RATE_LIMIT_KV.put(key, JSON.stringify({ count: Number(current.count || 0) + 1, attributes: aggregateAttributes }), {
      expirationTtl: 90 * 24 * 60 * 60
    });
    if (journey) {
      const occurredAt = new Date().toISOString();
      const rowKey = `event-row:${day}:${journey}:${Date.now()}:${crypto.randomUUID()}`;
      await env.RATE_LIMIT_KV.put(rowKey, JSON.stringify({
        journey,
        name,
        attributes: aggregateAttributes,
        occurredAt
      } satisfies ProductEventRow), {
        expirationTtl: 90 * 24 * 60 * 60
      });
    }
    return true;
  } catch {
    return false;
  }
}

export async function readProductFunnel(env: CloudflareChemEnv, days = 14): Promise<ProductFunnelReport | null> {
  if (!env.RATE_LIMIT_KV?.list) return null;
  const boundedDays = Math.max(1, Math.min(90, Math.trunc(days) || 14));
  const journeys = new Map<string, ProductJourneyRecord>();
  let scannedRows = 0;
  let truncated = false;
  for (let offset = 0; offset < boundedDays; offset += 1) {
    const day = new Date(Date.now() - offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const remaining = PRODUCT_FUNNEL_ROW_LIMIT - scannedRows;
    if (remaining <= 0) {
      truncated = true;
      break;
    }
    const listed = await listKvKeys(env.RATE_LIMIT_KV, `event-row:${day}:`, remaining);
    truncated ||= listed.truncated;
    for (let index = 0; index < listed.keys.length; index += PRODUCT_FUNNEL_READ_BATCH) {
      const batch = listed.keys.slice(index, index + PRODUCT_FUNNEL_READ_BATCH);
      const values = await Promise.all(batch.map((key) => env.RATE_LIMIT_KV?.get(key)));
      scannedRows += batch.length;
      for (const value of values) {
        if (!value) continue;
        try {
          const row = JSON.parse(value) as ProductEventRow;
          if (!normalizeJourney(row.journey) || !row.name || !row.occurredAt) continue;
          const record = journeys.get(row.journey) || { events: {}, firstSeenAt: row.occurredAt, lastSeenAt: row.occurredAt };
          record.events[row.name] = {
            attributes: row.attributes || {},
            count: Number(record.events[row.name]?.count || 0) + 1
          };
          if (row.occurredAt < record.firstSeenAt) record.firstSeenAt = row.occurredAt;
          if (row.occurredAt > record.lastSeenAt) record.lastSeenAt = row.occurredAt;
          journeys.set(row.journey, record);
        } catch {
          // Ignore malformed or stale telemetry records without failing the report.
        }
      }
    }
    if (truncated || scannedRows >= PRODUCT_FUNNEL_ROW_LIMIT) {
      truncated = true;
      break;
    }
  }

  const records = [...journeys.values()];

  const has = (record: ProductJourneyRecord, event: string) => Number(record.events[event]?.count || 0) > 0;
  const started = records.filter((record) => has(record, 'quantum_calculation_started'));
  const results = records.filter((record) => has(record, 'quantum_result_available'));
  const completed = records.filter((record) => has(record, 'quantum_calculation_completed'));
  const failed = records.filter((record) => has(record, 'quantum_calculation_failed'));
  const exported = records.filter((record) => has(record, 'export_completed'));
  const completedAfterStart = started.filter((record) => has(record, 'quantum_calculation_completed'));
  const exportedAfterResult = results.filter((record) => has(record, 'export_completed'));
  const firstRuns = started.filter((record) => record.events.quantum_calculation_started?.attributes.firstRun === 'true');
  const completedFirstRuns = firstRuns.filter((record) => has(record, 'quantum_calculation_completed'));

  return {
    days: boundedDays,
    generatedAt: new Date().toISOString(),
    journeys: records.length,
    scan: {
      rows: scannedRows,
      rowLimit: PRODUCT_FUNNEL_ROW_LIMIT,
      truncated
    },
    sample: {
      minimumJourneys: PRODUCT_FUNNEL_MINIMUM_JOURNEYS,
      sufficient: records.length >= PRODUCT_FUNNEL_MINIMUM_JOURNEYS
    },
    counts: {
      calculationStarted: started.length,
      resultAvailable: results.length,
      calculationCompleted: completed.length,
      calculationFailed: failed.length,
      exportCompleted: exported.length
    },
    rates: {
      completionAfterStart: ratio(completedAfterStart.length, started.length),
      exportAfterResult: ratio(exportedAfterResult.length, results.length),
      firstRunCompletion: ratio(completedFirstRuns.length, firstRuns.length)
    }
  };
}

type ProductJourneyRecord = {
  events: Record<string, { attributes: Record<string, string>; count: number }>;
  firstSeenAt: string;
  lastSeenAt: string;
};

type ProductEventRow = {
  journey: string;
  name: string;
  attributes: Record<string, string>;
  occurredAt: string;
};

function normalizeJourney(value: string | undefined) {
  const journey = String(value || '').trim();
  return /^[A-Za-z0-9_-]{8,60}$/u.test(journey) ? journey : '';
}

async function listKvKeys(namespace: CloudflareKvNamespace, prefix: string, maximum: number) {
  const keys: string[] = [];
  let cursor: string | undefined;
  let truncated = false;
  do {
    const remaining = maximum - keys.length;
    if (remaining <= 0) {
      truncated = true;
      break;
    }
    const page = await namespace.list({ prefix, cursor, limit: Math.min(1000, remaining) });
    keys.push(...page.keys.slice(0, remaining).map((entry) => entry.name));
    if (!page.list_complete && keys.length >= maximum) truncated = true;
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return { keys, truncated };
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? Number((numerator / denominator).toFixed(4)) : null;
}
