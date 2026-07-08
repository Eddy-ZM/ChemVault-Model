'use client';

import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { UserMenu } from '@/components/auth/UserMenu';
import { buildRegisterUrl } from '@/lib/auth/chemvaultUserLinks';

export function AuthButton() {
  const { ready, user, userOrigin } = useAuth();

  if (!ready) {
    return (
      <span className="h-10 w-24 rounded-full border border-slate-200 bg-white/80" aria-label="Loading authentication state" />
    );
  }

  if (user) return <UserMenu user={user} />;

  const registerUrl = buildRegisterUrl({ userOrigin, callbackPath: '/molecule' });

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/login"
        className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-sky-300 hover:text-sky-700"
      >
        Sign in
      </Link>
      <a
        href={registerUrl}
        className="hidden rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 sm:inline-flex"
      >
        Create account
      </a>
    </div>
  );
}
