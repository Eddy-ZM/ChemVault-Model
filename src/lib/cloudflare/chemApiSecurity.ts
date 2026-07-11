import type { CloudflareChemEnv } from './functions';
import { isAllowedOrigin } from './quantumSecurity';

const MAX_PUBLIC_JSON_BYTES = 64 * 1024;

export async function authorizePublicChemRequest(request: Request, env: CloudflareChemEnv) {
  const origin = request.headers.get('origin');
  if (origin && !isAllowedOrigin(origin, env)) {
    return { ok: false as const, status: 403, error: 'Origin is not allowed.' };
  }
  if (!env.CHEM_API_RATE_LIMITER) {
    return { ok: false as const, status: 503, error: 'Chemistry API rate limiting is not configured.' };
  }
  const clientAddress = request.headers.get('cf-connecting-ip') || 'unknown';
  const quota = await env.CHEM_API_RATE_LIMITER.limit({ key: `chem-api:${clientAddress}` });
  if (!quota.success) {
    return { ok: false as const, status: 429, error: 'Chemistry API rate limit reached.' };
  }
  return { ok: true as const };
}

export async function readBoundedJson(request: Request, maximumBytes = MAX_PUBLIC_JSON_BYTES) {
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > maximumBytes) {
    return { ok: false as const, status: 413, error: 'Request body is too large.' };
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maximumBytes) {
    return { ok: false as const, status: 413, error: 'Request body is too large.' };
  }
  try {
    return { ok: true as const, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false as const, status: 400, error: 'A valid JSON request body is required.' };
  }
}

export function publicChemOptionsAllowed(request: Request, env: CloudflareChemEnv) {
  const origin = request.headers.get('origin');
  return !origin || isAllowedOrigin(origin, env);
}
