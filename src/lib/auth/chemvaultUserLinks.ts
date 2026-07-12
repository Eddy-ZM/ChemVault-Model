export type OAuthProvider = 'apple' | 'google' | 'github';
export type UserPortalSection = 'account' | 'profile' | 'settings' | 'security';

export type AuthLinkOptions = {
  userOrigin: string;
  callbackPath?: string;
};

const DEFAULT_CALLBACK_PATH = '/molecule';
const MODEL_ORIGIN = process.env.NEXT_PUBLIC_CHEMVAULT_MODEL_ORIGIN || 'https://model.chemvault.science';
const USER_PORTAL_PATHS: Record<UserPortalSection, string> = {
  account: '/',
  profile: '/profile',
  settings: '/settings',
  security: '/settings/security'
};

export function buildOAuthUrl(provider: OAuthProvider, options: AuthLinkOptions) {
  const returnTo = resolveReturnTo(options.callbackPath);
  const url = new URL(`/api/auth/oauth/${provider}`, normalizeOrigin(options.userOrigin));
  setUserContextParams(url, returnTo);
  url.searchParams.set('hideUserSystemBack', '1');
  return url.toString();
}

export function buildRegisterUrl(options: AuthLinkOptions) {
  const returnTo = resolveReturnTo(options.callbackPath);
  const url = new URL('/register', normalizeOrigin(options.userOrigin));
  setUserContextParams(url, returnTo);
  url.searchParams.set('hideBack', '1');
  url.searchParams.set('hideNav', '1');
  url.searchParams.set('hideUserSystemBack', '1');
  url.searchParams.set('disableBack', '1');
  url.searchParams.set('disableUserSystemBack', '1');
  url.searchParams.set('allowUserSystemBack', '0');
  return url.toString();
}

export function buildUserPortalUrl(section: UserPortalSection, options: AuthLinkOptions) {
  const returnTo = resolveReturnTo(options.callbackPath);
  const url = new URL(USER_PORTAL_PATHS[section], normalizeOrigin(options.userOrigin));
  setUserContextParams(url, returnTo);
  return url.toString();
}

function resolveReturnTo(callbackPath = DEFAULT_CALLBACK_PATH) {
  const safePath = callbackPath.startsWith('/') ? callbackPath : DEFAULT_CALLBACK_PATH;
  return new URL(safePath, MODEL_ORIGIN).toString();
}

function normalizeOrigin(origin: string) {
  return origin.endsWith('/') ? origin.slice(0, -1) : origin;
}

function setUserContextParams(url: URL, returnTo: string) {
  url.searchParams.set('app', 'molecule');
  url.searchParams.set('source', 'model');
  url.searchParams.set('returnTo', returnTo);
  url.searchParams.set('callbackUrl', returnTo);
}
