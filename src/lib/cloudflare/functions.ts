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
  RATE_LIMIT_KV?: CloudflareKvNamespace;
  PRODUCT_ANALYTICS?: CloudflareAnalyticsEngine;
};

export type CloudflareKvNamespace = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
};

export type CloudflareAnalyticsEngine = {
  writeDataPoint(event: { blobs?: string[]; doubles?: number[]; indexes?: string[] }): void;
};

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
