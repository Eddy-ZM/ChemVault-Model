'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { OAuthProvider, buildOAuthUrl, buildRegisterUrl } from '@/lib/auth/chemvaultUserLinks';

const oauthProviders: Array<{ id: OAuthProvider; label: string; className: string; iconWrapClassName: string }> = [
  {
    id: 'apple',
    label: 'Apple',
    className: 'border-black bg-black text-white hover:bg-zinc-800 focus-visible:ring-zinc-300',
    iconWrapClassName: 'bg-white text-black'
  },
  {
    id: 'google',
    label: 'Google',
    className: 'border-slate-300 bg-white text-slate-800 hover:border-[#4285F4] hover:text-[#1a73e8] focus-visible:ring-[#4285F4]/30',
    iconWrapClassName: 'bg-white text-slate-900'
  },
  {
    id: 'github',
    label: 'GitHub',
    className: 'border-[#24292f] bg-[#24292f] text-white hover:bg-[#1f2328] focus-visible:ring-[#24292f]/30',
    iconWrapClassName: 'bg-white text-[#24292f]'
  }
];

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, loading, user, ready, userOrigin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const callbackUrl = safeCallbackUrl(searchParams.get('callbackUrl'));
  const oauthLinks = useMemo(
    () =>
      oauthProviders.map((provider) => ({
        ...provider,
        href: buildOAuthUrl(provider.id, { userOrigin, callbackPath: callbackUrl })
      })),
    [callbackUrl, userOrigin]
  );
  const registerUrl = useMemo(() => buildRegisterUrl({ userOrigin, callbackPath: callbackUrl }), [callbackUrl, userOrigin]);

  useEffect(() => {
    if (ready && user) router.replace(callbackUrl);
  }, [callbackUrl, ready, router, user]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextEmail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(nextEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Enter your ChemVault password.');
      return;
    }

    setError(null);
    try {
      await login({ email: nextEmail, password });
      router.push(callbackUrl);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Sign in failed.');
    }
  };

  return (
    <div className="mx-auto w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">ChemVault account</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Sign in to ChemVault</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Use your ChemVault User account. Molecule Studio remains fully usable without signing in.
        </p>
      </div>

      <div className="mt-6 grid gap-2">
        {oauthLinks.map((provider) => (
          <a
            key={provider.id}
            href={provider.href}
            className={`flex items-center justify-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold shadow-sm transition focus-visible:outline-none focus-visible:ring-4 ${provider.className}`}
          >
            <span className={`grid h-7 w-7 place-items-center rounded-lg ${provider.iconWrapClassName}`} aria-hidden="true">
              <OAuthProviderIcon provider={provider.id} />
            </span>
            Continue with {provider.label}
          </a>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">or</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <form onSubmit={onSubmit} className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <label className="block text-sm font-medium text-slate-700" htmlFor="auth-email">
          Email
        </label>
        <input
          id="auth-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
        />
        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="auth-password">
          Password
        </label>
        <input
          id="auth-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
        />
        {error ? <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="mt-4 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <div className="mt-6 grid gap-3">
        <a
          href={registerUrl}
          className="rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-slate-700 transition hover:border-sky-300"
        >
          Create ChemVault account
        </a>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-slate-500">You can continue using Molecule Studio without signing in.</p>
        <Link href="/molecule" className="font-semibold text-sky-700 hover:text-sky-800">
          Back to Molecule Studio
        </Link>
      </div>
    </div>
  );
}

function safeCallbackUrl(value: string | null): Route {
  if (value === '/profile' || value === '/molecules' || value === '/settings' || value === '/molecule') return value;
  return '/molecule';
}

function OAuthProviderIcon({ provider }: { provider: OAuthProvider }) {
  if (provider === 'apple') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" focusable="false" aria-hidden="true">
        <path d="M16.36 1.43c.02 1.07-.39 2.1-1.12 2.88-.78.86-2.06 1.52-3.1 1.43-.12-1.02.42-2.13 1.13-2.88.79-.84 2.17-1.49 3.09-1.43ZM20.5 17.27c-.45 1.04-.67 1.5-1.25 2.42-.81 1.23-1.95 2.77-3.36 2.78-1.26.01-1.58-.82-3.28-.81-1.7.01-2.06.82-3.32.81-1.42-.01-2.5-1.4-3.31-2.64-2.27-3.49-2.51-7.58-1.1-9.76 1-1.55 2.58-2.46 4.07-2.46 1.52 0 2.48.83 3.73.83 1.22 0 1.96-.84 3.72-.84 1.33 0 2.74.72 3.74 1.97-3.28 1.8-2.75 6.48.36 7.7Z" />
      </svg>
    );
  }

  if (provider === 'google') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" focusable="false" aria-hidden="true">
        <path fill="#4285F4" d="M21.6 12.23c0-.76-.07-1.49-.2-2.19H12v4.14h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.25c1.9-1.75 2.97-4.33 2.97-7.48Z" />
        <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.63-2.43l-3.25-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.75-5.59-4.11H3.06v2.59A10 10 0 0 0 12 22Z" />
        <path fill="#FBBC05" d="M6.41 13.91a6.02 6.02 0 0 1 0-3.82V7.5H3.06a10 10 0 0 0 0 9l3.35-2.59Z" />
        <path fill="#EA4335" d="M12 5.98c1.47 0 2.79.51 3.83 1.5l2.88-2.88C16.97 2.98 14.7 2 12 2a10 10 0 0 0-8.94 5.5l3.35 2.59C7.2 7.73 9.4 5.98 12 5.98Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" focusable="false" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.58 2 12.24c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.63.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.9 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.55-1.14-4.55-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.31.1-2.71 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.96c.85 0 1.7.12 2.5.34 1.9-1.33 2.74-1.05 2.74-1.05.55 1.4.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.8-4.57 5.05.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.8 0 .27.18.59.69.49A10.1 10.1 0 0 0 22 12.24C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}
