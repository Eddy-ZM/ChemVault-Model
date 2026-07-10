const EVENT_NAMES = new Set([
  'molecule_search_completed',
  'molecule_search_failed',
  'structure_generation_completed',
  'structure_generation_failed',
  'quantum_calculation_completed',
  'quantum_calculation_failed',
  'export_completed'
]);
const ATTRIBUTE_KEYS = new Set(['source', 'engine', 'task', 'status', 'duration', 'atomBand', 'format', 'cached']);
type RequestContext = { request: Request };

export const onRequestPost = async ({ request }: RequestContext) => {
  try {
    const payload = await request.json() as { name?: unknown; attributes?: Record<string, unknown> };
    const name = typeof payload.name === 'string' && EVENT_NAMES.has(payload.name) ? payload.name : '';
    if (!name) return Response.json({ error: 'Unsupported product event.' }, { status: 400 });
    const attributes = Object.fromEntries(
      Object.entries(payload.attributes || {})
        .filter(([key, value]) => ATTRIBUTE_KEYS.has(key) && ['string', 'number', 'boolean'].includes(typeof value))
        .map(([key, value]) => [key, String(value).slice(0, 60)])
    );
    console.info(JSON.stringify({ type: 'chemvault_product_event', name, attributes, receivedAt: new Date().toISOString() }));
    return new Response(null, { status: 204 });
  } catch {
    return Response.json({ error: 'Invalid product event.' }, { status: 400 });
  }
};

export const onRequestOptions = async () => new Response(null, { status: 204 });
