import { fetchWithTimeout } from '../../../../src/lib/chem/http';
import {
  CloudflarePagesContext,
  jsonResponse,
  optionsResponse,
  quantumBackendToken,
  quantumBackendUrl
} from '../../../../src/lib/cloudflare/functions';

type QuantumPayload = {
  moleculeName?: string;
  structureData?: string;
  format?: string;
  method?: string;
  charge?: number;
  multiplicity?: number;
};

const MAX_STRUCTURE_BYTES = 2_000_000;

export function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestPost(context: CloudflarePagesContext) {
  const body = (await context.request.json().catch(() => null)) as QuantumPayload | null;
  const structureData = typeof body?.structureData === 'string' ? body.structureData.trim() : '';
  const format = normalizeFormat(body?.format);
  const method = normalizeMethod(body?.method);
  const charge = Number.isFinite(body?.charge) ? Number(body?.charge) : 0;
  const multiplicity = Number.isFinite(body?.multiplicity) ? Math.max(1, Number(body?.multiplicity)) : 1;

  if (!structureData) {
    return jsonResponse({ success: false, status: 'invalid-input', error: 'structureData is required' }, 400);
  }

  if (new TextEncoder().encode(structureData).byteLength > MAX_STRUCTURE_BYTES) {
    return jsonResponse({ success: false, status: 'too-large', error: 'Structure payload is too large for quantum submission.' }, 413);
  }

  const backendUrl = quantumBackendUrl(context.env);
  if (!backendUrl) {
    return jsonResponse(
      {
        success: false,
        status: 'unconfigured',
        engine: 'none',
        method,
        error: 'Professional quantum engine is not configured for this deployment.'
      },
      503
    );
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
  const token = quantumBackendToken(context.env);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetchWithTimeout(calculationEndpoint(backendUrl), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        moleculeName: typeof body?.moleculeName === 'string' ? body.moleculeName : null,
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
        response.status === 400 ? 400 : 502
      );
    }

    return jsonResponse({
      success: true,
      status: payload?.status || 'completed',
      engine: payload?.engine || 'remote-quantum',
      method: payload?.method || method,
      ...payload
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        status: 'failed',
        engine: 'remote-quantum',
        method,
        error: error instanceof Error ? error.message : 'Quantum calculation failed.'
      },
      502
    );
  }
}

function calculationEndpoint(baseUrl: string) {
  const clean = baseUrl.replace(/\/+$/u, '');
  return /\/calculate$/iu.test(clean) ? clean : `${clean}/calculate`;
}

function normalizeFormat(format: unknown) {
  const value = typeof format === 'string' ? format.toLowerCase() : 'xyz';
  return ['xyz', 'sdf', 'mol', 'pdb', 'cif'].includes(value) ? value : 'xyz';
}

function normalizeMethod(method: unknown) {
  const value = typeof method === 'string' ? method.trim() : '';
  if (/^gfn2[-_ ]?xtb$/iu.test(value)) return 'gfn2-xTB';
  if (/^gfn1[-_ ]?xtb$/iu.test(value)) return 'gfn1-xTB';
  if (/dft/iu.test(value)) return value;
  return 'gfn2-xTB';
}

function parseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
