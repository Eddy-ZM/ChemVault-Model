'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { OAuthProvider, buildOAuthUrl, buildRegisterUrl } from '@/lib/auth/chemvaultUserLinks';

const oauthProviders: Array<{ id: OAuthProvider; label: string; mark: string }> = [
  { id: 'apple', label: 'Apple', mark: 'A' },
  { id: 'google', label: 'Google', mark: 'G' },
  { id: 'github', label: 'GitHub', mark: 'GH' }
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
            className="flex items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:border-sky-300 hover:text-sky-800"
          >
            <span className="grid h-6 min-w-6 place-items-center rounded-md border border-slate-200 bg-slate-50 px-1 text-[11px] font-bold">
              {provider.mark}
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
