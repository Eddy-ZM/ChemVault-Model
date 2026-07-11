import type { CloudflareChemEnv } from './functions';

export type QuantumRequestPayload = {
  moleculeName?: unknown;
  structureData?: unknown;
  format?: unknown;
  method?: unknown;
  charge?: unknown;
  multiplicity?: unknown;
};

export type ValidQuantumRequest = {
  moleculeName: string | null;
  structureData: string;
  format: 'xyz' | 'sdf' | 'mol' | 'pdb' | 'cif';
  method: 'gfn2-xTB' | 'gfn1-xTB' | 'DFT PBE0/def2-SVP';
  charge: number;
  multiplicity: number;
  atomCount: number;
};

export type QuantumAccessIdentity = {
  id: string;
  email: string;
};

const MAX_STRUCTURE_BYTES = 2_000_000;
const MAX_ATOMS = 400;
const FORMATS = new Set<ValidQuantumRequest['format']>(['xyz', 'sdf', 'mol', 'pdb', 'cif']);
const METHODS = new Map<string, ValidQuantumRequest['method']>([
  ['gfn2-xtb', 'gfn2-xTB'],
  ['gfn1-xtb', 'gfn1-xTB'],
  ['dft pbe0/def2-svp', 'DFT PBE0/def2-SVP'],
  ['dft-pbe0-def2-svp', 'DFT PBE0/def2-SVP']
]);

export function validateQuantumPayload(payload: QuantumRequestPayload | null):
  | { ok: true; value: ValidQuantumRequest }
  | { ok: false; status: number; error: string } {
  if (!payload || typeof payload !== 'object') return invalid('A JSON request body is required.');
  const structureData = typeof payload.structureData === 'string' ? payload.structureData.trim() : '';
  if (!structureData) return invalid('structureData is required.');
  if (new TextEncoder().encode(structureData).byteLength > MAX_STRUCTURE_BYTES) {
    return { ok: false, status: 413, error: 'Structure payload is too large for quantum submission.' };
  }

  const formatValue = typeof payload.format === 'string' ? payload.format.trim().toLowerCase() : 'xyz';
  if (!FORMATS.has(formatValue as ValidQuantumRequest['format'])) return invalid('Unsupported structure format.');
  const format = formatValue as ValidQuantumRequest['format'];

  const methodKey = typeof payload.method === 'string' ? payload.method.trim().toLowerCase() : 'gfn2-xtb';
  const method = METHODS.get(methodKey);
  if (!method) return invalid('Unsupported quantum method.');

  const charge = integerInRange(payload.charge, 0, -20, 20);
  if (charge === null) return invalid('Charge must be an integer from -20 to 20.');
  const multiplicity = integerInRange(payload.multiplicity, 1, 1, 11);
  if (multiplicity === null) return invalid('Multiplicity must be an integer from 1 to 11.');

  const atomCount = estimateAtomCount(structureData, format);
  if (atomCount < 1) return invalid('No atoms were found in the submitted structure.');
  if (atomCount > MAX_ATOMS) {
    return { ok: false, status: 413, error: `Cloud quantum calculations support at most ${MAX_ATOMS} atoms per job.` };
  }

  const moleculeName = typeof payload.moleculeName === 'string' ? payload.moleculeName.trim().slice(0, 160) || null : null;
  return { ok: true, value: { moleculeName, structureData, format, method, charge, multiplicity, atomCount } };
}

export async function authorizeQuantumRequest(request: Request, env: CloudflareChemEnv): Promise<QuantumAccessIdentity | null> {
  const cookie = request.headers.get('cookie') || '';
  const authorization = request.headers.get('authorization') || '';
  if (!cookie && !authorization) return null;

  const userOrigin = (env.CHEMVAULT_USER_ORIGIN || 'https://user.chemvault.science').replace(/\/+$/u, '');
  const headers = new Headers({ Accept: 'application/json', 'X-ChemVault-Client': 'model-quantum-gateway' });
  if (cookie) headers.set('Cookie', cookie);
  if (authorization) {
    headers.set('Authorization', authorization);
    const bearer = authorization.match(/^Bearer\s+(.+)$/iu)?.[1]?.trim();
    if (!cookie && bearer) headers.set('Cookie', `chemvault_session=${encodeURIComponent(bearer)}`);
  }

  const response = await fetch(`${userOrigin}/api/access/check?service=chemvault_molecule`, {
    method: 'GET',
    headers,
    redirect: 'manual'
  });
  if (!response.ok) return null;
  const body = await response.json().catch(() => null) as { allowed?: unknown; user?: { id?: unknown; email?: unknown } } | null;
  if (body?.allowed !== true || typeof body.user?.id !== 'string' || typeof body.user?.email !== 'string') return null;
  return { id: body.user.id, email: body.user.email };
}

export function quantumCorsHeaders(request: Request, env: CloudflareChemEnv) {
  const origin = request.headers.get('origin');
  const allowedOrigin = origin && isAllowedOrigin(origin, env) ? origin : 'https://model.chemvault.science';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin'
  };
}

export function isAllowedOrigin(origin: string, env: CloudflareChemEnv) {
  const configured = String(env.CHEMVAULT_ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const allowed = new Set(['https://model.chemvault.science', ...configured]);
  if (allowed.has(origin)) return true;
  try {
    const url = new URL(origin);
    return (url.hostname === 'localhost' || url.hostname === '127.0.0.1') && ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

export function quantumQuotaKey(identity: QuantumAccessIdentity) {
  return `quantum:${identity.id}`;
}

export function validateQuantumGatewayConfig(env: CloudflareChemEnv) {
  if (!(env.QUANTUM_API_URL || env.CHEMVAULT_QUANTUM_API_URL)) {
    return { ok: false as const, error: 'Professional quantum engine is not configured for this deployment.' };
  }
  if (!(env.QUANTUM_API_TOKEN || env.CHEMVAULT_QUANTUM_API_TOKEN)) {
    return { ok: false as const, error: 'Professional quantum engine authentication is not configured.' };
  }
  if (!env.RATE_LIMIT_KV) {
    return { ok: false as const, error: 'Cloud quantum rate limiting is not configured.' };
  }
  return { ok: true as const };
}

function invalid(error: string) {
  return { ok: false as const, status: 400, error };
}

function integerInRange(value: unknown, fallback: number, minimum: number, maximum: number) {
  const normalized = value === undefined || value === null ? fallback : Number(value);
  return Number.isInteger(normalized) && normalized >= minimum && normalized <= maximum ? normalized : null;
}

function estimateAtomCount(structure: string, format: ValidQuantumRequest['format']) {
  const lines = structure.split(/\r?\n/u);
  if (format === 'xyz') {
    const declared = Number.parseInt(lines[0]?.trim() || '', 10);
    if (Number.isInteger(declared) && declared > 0) return declared;
  }
  if (format === 'pdb') return lines.filter((line) => /^(ATOM  |HETATM)/u.test(line)).length;
  if (format === 'mol' || format === 'sdf') {
    const declared = Number.parseInt(lines[3]?.slice(0, 3).trim() || '', 10);
    if (Number.isInteger(declared) && declared > 0) return declared;
  }
  return lines.filter((line) => /^\s*[A-Z][a-z]?\s+[-+]?\d/u.test(line)).length;
}
