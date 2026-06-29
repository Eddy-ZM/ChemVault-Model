export type OAuthProvider = 'apple' | 'google' | 'github';

export type AuthLinkOptions = {
  userOrigin: string;
  callbackPath?: string;
};

const DEFAULT_CALLBACK_PATH = '/molecule';
const MODEL_ORIGIN = process.env.NEXT_PUBLIC_CHEMVAULT_MODEL_ORIGIN || 'https://model.chemvault.science';

export function buildOAuthUrl(provider: OAuthProvider, options: AuthLinkOptions) {
  const returnTo = resolveReturnTo(options.callbackPath);
  const url = new URL(`/api/auth/oauth/${provider}`, normalizeOrigin(options.userOrigin));
  url.searchParams.set('app', 'molecule');
  url.searchParams.set('returnTo', returnTo);
  url.searchParams.set('callbackUrl', returnTo);
  url.searchParams.set('source', 'model');
  url.searchParams.set('hideUserSystemBack', '1');
  return url.toString();
}

export function buildRegisterUrl(options: AuthLinkOptions) {
  const returnTo = resolveReturnTo(options.callbackPath);
  const url = new URL('/register', normalizeOrigin(options.userOrigin));
  url.searchParams.set('app', 'molecule');
  url.searchParams.set('source', 'model');
  url.searchParams.set('returnTo', returnTo);
  url.searchParams.set('callbackUrl', returnTo);
  url.searchParams.set('hideBack', '1');
  url.searchParams.set('hideNav', '1');
  url.searchParams.set('hideUserSystemBack', '1');
  url.searchParams.set('disableBack', '1');
  url.searchParams.set('disableUserSystemBack', '1');
  url.searchParams.set('allowUserSystemBack', '0');
  return url.toString();
}

function resolveReturnTo(callbackPath = DEFAULT_CALLBACK_PATH) {
  const safePath = callbackPath.startsWith('/') ? callbackPath : DEFAULT_CALLBACK_PATH;
  return new URL(safePath, MODEL_ORIGIN).toString();
}

function normalizeOrigin(origin: string) {
  return origin.endsWith('/') ? origin.slice(0, -1) : origin;
}
