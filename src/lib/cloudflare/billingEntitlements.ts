import type { CloudflareChemEnv } from './functions';

export type BillingPlan = 'anonymous' | 'free' | 'pro' | 'team' | 'enterprise' | 'admin';
export type BillingEnforcementMode = 'off' | 'shadow' | 'enforce';

export type CloudQuantumUsage = {
  allowed: boolean;
  enforced: boolean;
  plan: BillingPlan;
  source: 'billing' | 'disabled' | 'fallback';
  reason?: 'subscription_required' | 'quota_exhausted' | 'billing_unavailable';
  status?: number;
  message?: string;
  limit?: number;
  used?: number;
  remaining?: number;
  periodEnd?: string;
  observedAllowed?: boolean;
};

const validPlans = new Set<BillingPlan>(['anonymous', 'free', 'pro', 'team', 'enterprise', 'admin']);
const featureKey = 'modeling.cloud_quantum';

export async function consumeCloudQuantumUsage(
  env: CloudflareChemEnv,
  userId: string,
  requestId: string,
): Promise<CloudQuantumUsage> {
  const mode = billingEnforcementMode(env);
  if (mode === 'off') return { allowed: true, enforced: false, plan: 'free', source: 'disabled' };

  const cleanUserId = userId.trim();
  const cleanRequestId = normalizeRequestId(requestId);
  const secret = env.BILLING_SERVICE_SECRET?.trim() || '';
  if (!cleanUserId || !cleanRequestId || !secret) {
    return unavailable(mode, cleanUserId && cleanRequestId
      ? 'Cloud quantum billing is not configured.'
      : 'Verified billing identity and request ID are required.');
  }

  let response: Response;
  try {
    response = await fetch(`${billingOrigin(env)}/api/internal/billing/usage/consume`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${secret}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ userId: cleanUserId, featureKey, requestId: cleanRequestId, amount: 1 }),
      signal: AbortSignal.timeout(8_000)
    });
  } catch {
    return unavailable(mode, 'Cloud quantum billing is unavailable.');
  }

  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  const plan = normalizePlan(payload?.plan);
  const valid = payload?.ok === true
    && payload?.userId === cleanUserId
    && payload?.featureKey === featureKey
    && plan
    && typeof payload?.allowed === 'boolean';
  if (!valid) return unavailable(mode, 'Cloud quantum billing returned an invalid response.');

  const observedAllowed = payload.allowed as boolean;
  const reason = normalizeReason(payload.reason);
  const usage = {
    plan,
    limit: nonNegativeInteger(payload.limit),
    used: nonNegativeInteger(payload.used),
    remaining: nonNegativeInteger(payload.remaining),
    periodEnd: typeof payload.periodEnd === 'string' ? payload.periodEnd : undefined
  };
  if (observedAllowed) {
    return { allowed: true, enforced: mode === 'enforce', source: 'billing', ...usage };
  }
  if (mode === 'shadow') {
    return { allowed: true, enforced: false, source: 'billing', observedAllowed: false, reason, ...usage };
  }

  const subscriptionRequired = reason === 'subscription_required';
  return {
    allowed: false,
    enforced: true,
    source: 'billing',
    reason: subscriptionRequired ? 'subscription_required' : 'quota_exhausted',
    status: subscriptionRequired ? 402 : 429,
    message: subscriptionRequired
      ? 'Cloud quantum calculation requires ChemVault Pro or higher.'
      : 'Your daily cloud quantum calculation quota has been reached.',
    ...usage
  };
}

export function billingEnforcementMode(env: CloudflareChemEnv): BillingEnforcementMode {
  const configured = env.BILLING_ENFORCEMENT_MODE?.trim().toLowerCase();
  if (configured === 'off' || configured === 'shadow' || configured === 'enforce') return configured;
  return env.APP_ENV?.trim().toLowerCase() === 'production' ? 'enforce' : 'shadow';
}

export function quantumUsageRequestId(request: Request) {
  void request;
  return crypto.randomUUID();
}

function unavailable(mode: BillingEnforcementMode, message: string): CloudQuantumUsage {
  if (mode === 'enforce') {
    return {
      allowed: false,
      enforced: true,
      plan: 'free',
      source: 'fallback',
      reason: 'billing_unavailable',
      status: 503,
      message
    };
  }
  return { allowed: true, enforced: false, plan: 'free', source: 'fallback', reason: 'billing_unavailable' };
}

function billingOrigin(env: CloudflareChemEnv) {
  const raw = (env.BILLING_API_ORIGIN || 'https://chemvault.science').trim().replace(/\/+$/u, '');
  const url = new URL(raw);
  if (env.APP_ENV?.trim().toLowerCase() === 'production' && url.protocol !== 'https:') {
    throw new Error('Billing API origin must use HTTPS in production.');
  }
  return url.toString().replace(/\/+$/u, '');
}

function normalizePlan(value: unknown): BillingPlan | null {
  if (typeof value !== 'string') return null;
  const plan = value.trim().toLowerCase() as BillingPlan;
  return validPlans.has(plan) ? plan : null;
}

function normalizeReason(value: unknown): 'subscription_required' | 'quota_exhausted' {
  return value === 'subscription_required' ? 'subscription_required' : 'quota_exhausted';
}

function normalizeRequestId(value: string) {
  const requestId = value.trim();
  return /^[A-Za-z0-9._:-]{16,128}$/u.test(requestId) ? requestId : '';
}

function nonNegativeInteger(value: unknown) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : undefined;
}
