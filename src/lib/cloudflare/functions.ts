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
  CHEM_API_RATE_LIMITER?: CloudflareRateLimiter;
  QUANTUM_RATE_LIMITER?: CloudflareRateLimiter;
  PRODUCT_EVENTS_RATE_LIMITER?: CloudflareRateLimiter;
  PRODUCT_ANALYTICS?: CloudflareAnalyticsEngine;
};

export type CloudflareRateLimiter = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
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
