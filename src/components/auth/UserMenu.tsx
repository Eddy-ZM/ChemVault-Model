'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AuthUser, useAuth } from '@/components/auth/AuthProvider';

const menuItems: Array<{ label: string; href: Route; note: string }> = [
  { label: 'Profile', href: '/profile', note: 'Coming soon' },
  { label: 'My Molecules', href: '/molecules', note: 'Coming soon' },
  { label: 'Settings', href: '/settings', note: 'Coming soon' }
];

export function UserMenu({ user }: { user: AuthUser }) {
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-sky-300"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-950 text-xs font-bold uppercase text-white">
          {initials(user)}
        </span>
        <span className="hidden max-w-40 truncate md:block">{user.name || user.email}</span>
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl" role="menu">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-semibold text-slate-950">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <div className="p-2">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                role="menuitem"
              >
                <span>{item.label}</span>
                <span className="text-[10px] uppercase tracking-[0.16em] text-slate-400">{item.note}</span>
              </Link>
            ))}
            <button
              type="button"
              onClick={() => {
                signOut();
                setOpen(false);
              }}
              className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-rose-700 transition hover:bg-rose-50"
              role="menuitem"
            >
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function initials(user: AuthUser) {
  const source = user.name || user.email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`;
  return source.slice(0, 2) || 'CV';
}
