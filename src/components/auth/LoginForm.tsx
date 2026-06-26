'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signInDemo } = useAuth();
  const [email, setEmail] = useState('researcher@chemvault.science');
  const [name, setName] = useState('ChemVault Researcher');
  const [error, setError] = useState<string | null>(null);

  const callbackUrl = safeCallbackUrl(searchParams.get('callbackUrl'));

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextEmail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(nextEmail)) {
      setError('Enter a valid email address for the demo session.');
      return;
    }
    signInDemo({ email: nextEmail, name });
    router.push(callbackUrl);
  };

  return (
    <div className="mx-auto w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Optional account</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Sign in to ChemVault</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Access saved molecules, history and future cloud features. Molecule Studio remains fully usable without signing in.
        </p>
      </div>

      <div className="mt-6 grid gap-3">
        <button type="button" disabled className="rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-400">
          Continue with Google — coming soon
        </button>
        <button type="button" disabled className="rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-400">
          Continue with GitHub — coming soon
        </button>
        <a
          href="https://user.chemvault.science"
          className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-sky-300"
        >
          Open ChemVault User Portal
        </a>
      </div>

      <form onSubmit={onSubmit} className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-800">Demo local session</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          This stores only a display profile in your browser. It is not production authentication and does not unlock paid or server-side features.
        </p>
        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="auth-name">
          Name
        </label>
        <input
          id="auth-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
        />
        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="auth-email">
          Email
        </label>
        <input
          id="auth-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
        />
        {error ? <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        <button type="submit" className="mt-4 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
          Continue with demo session
        </button>
      </form>

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
