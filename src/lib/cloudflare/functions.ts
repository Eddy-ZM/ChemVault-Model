export type CloudflareChemEnv = {
  MOLECULE_API_URL?: string;
  NEXT_PUBLIC_MOLECULE_API_URL?: string;
  VITE_MOLECULE_API_URL?: string;
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

export function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders
    }
  });
}

export function optionsResponse() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

export function readStringParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export function moleculeBackendUrl(env: CloudflareChemEnv) {
  return env.MOLECULE_API_URL || env.NEXT_PUBLIC_MOLECULE_API_URL || env.VITE_MOLECULE_API_URL || '';
}
