'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MouseEvent, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { UserMenu } from '@/components/auth/UserMenu';
import { buildRegisterUrl } from '@/lib/auth/chemvaultUserLinks';

export function AuthButton() {
  const router = useRouter();
  const { ready, user, userOrigin } = useAuth();
  const [openingLogin, setOpeningLogin] = useState(false);
  const navigationTimer = useRef<number | null>(null);

  useEffect(() => {
    router.prefetch('/login');
    return () => {
      if (navigationTimer.current !== null) window.clearTimeout(navigationTimer.current);
    };
  }, [router]);

  const openLogin = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (openingLogin) return;
    setOpeningLogin(true);
    navigationTimer.current = window.setTimeout(() => router.push('/login'), 160);
  };

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
        onClick={openLogin}
        aria-busy={openingLogin}
        className={`cv-login-launch rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-sky-300 hover:text-sky-700 ${openingLogin ? 'is-opening' : ''}`}
      >
        <span>{openingLogin ? 'Opening' : 'Sign in'}</span>
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
