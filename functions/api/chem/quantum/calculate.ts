import { fetchWithTimeout } from '../../../../src/lib/chem/http';
import {
  CloudflarePagesContext,
  consumeRateLimit,
  jsonResponse,
  optionsResponse,
  quantumBackendToken,
  quantumBackendUrl
} from '../../../../src/lib/cloudflare/functions';
import {
  authorizeQuantumRequest,
  isAllowedOrigin,
  quantumCorsHeaders,
  quantumQuotaKey,
  type QuantumRequestPayload,
  validateQuantumGatewayConfig,
  validateQuantumPayload
} from '../../../../src/lib/cloudflare/quantumSecurity';

export function onRequestOptions(context: CloudflarePagesContext) {
  const origin = context.request.headers.get('origin');
  if (origin && !isAllowedOrigin(origin, context.env)) return new Response(null, { status: 403 });
  return optionsResponse(quantumCorsHeaders(context.request, context.env));
}

export async function onRequestPost(context: CloudflarePagesContext) {
  const cors = quantumCorsHeaders(context.request, context.env);
  const origin = context.request.headers.get('origin');
  if (origin && !isAllowedOrigin(origin, context.env)) return jsonResponse({ success: false, status: 'forbidden-origin', error: 'Origin is not allowed.' }, 403, cors);
  const contentLength = Number(context.request.headers.get('content-length') || 0);
  if (contentLength > 2_100_000) return jsonResponse({ success: false, status: 'too-large', error: 'Request body is too large.' }, 413, cors);

  const identity = await authorizeQuantumRequest(context.request, context.env).catch(() => null);
  if (!identity) return jsonResponse({ success: false, status: 'unauthorized', error: 'Sign in with an authorized ChemVault account before using cloud quantum calculation.' }, 401, cors);

  const body = (await context.request.json().catch(() => null)) as QuantumRequestPayload | null;
  const validation = validateQuantumPayload(body);
  if (!validation.ok) return jsonResponse({ success: false, status: 'invalid-input', error: validation.error }, validation.status, cors);
  const { moleculeName, structureData, format, method, charge, multiplicity } = validation.value;

  const gateway = validateQuantumGatewayConfig(context.env);
  if (!gateway.ok) {
    return jsonResponse(
      {
        success: false,
        status: 'unconfigured',
        engine: 'none',
        method,
        error: gateway.error
      },
      503,
      cors
    );
  }
  const backendUrl = quantumBackendUrl(context.env);
  const token = quantumBackendToken(context.env);
  const quota = await consumeRateLimit(context.env, quantumQuotaKey(identity), 6);
  if (quota.unavailable) return jsonResponse({ success: false, status: 'unavailable', error: 'Quantum rate limiting is temporarily unavailable.' }, 503, cors);
  if (!quota.success) return jsonResponse({ success: false, status: 'rate-limited', error: 'Quantum calculation quota reached. Try again later.' }, 429, { ...cors, 'Retry-After': '60' });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
  headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetchWithTimeout(calculationEndpoint(backendUrl), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        moleculeName,
        structureData,
        format,
        method,
        charge,
        multiplicity
      }),
      timeoutMs: 120000
    });

    const text = await response.text();
    const payload = parseJson(text);
    if (!response.ok) {
      return jsonResponse(
        {
          success: false,
          status: 'failed',
          engine: 'remote-quantum',
          method,
          error: payload?.error || payload?.message || text || 'Quantum calculation failed.'
        },
        response.status === 400 ? 400 : 502,
        cors
      );
    }

    return jsonResponse({
      success: true,
      status: payload?.status || 'completed',
      engine: payload?.engine || 'remote-quantum',
      method: payload?.method || method,
      ...payload
    }, 200, cors);
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        status: 'failed',
        engine: 'remote-quantum',
        method,
        error: error instanceof Error ? error.message : 'Quantum calculation failed.'
      },
      502,
      cors
    );
  }
}

function calculationEndpoint(baseUrl: string) {
  const clean = baseUrl.replace(/\/+$/u, '');
  return /\/calculate$/iu.test(clean) ? clean : `${clean}/calculate`;
}

function parseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
