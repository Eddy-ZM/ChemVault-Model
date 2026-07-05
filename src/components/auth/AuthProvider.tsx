'use client';

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

const USER_ORIGIN = process.env.NEXT_PUBLIC_CHEMVAULT_USER_ORIGIN || 'https://user.chemvault.science';
const DESKTOP_USER_API_PREFIX = '/desktop-user-api';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  role?: string | null;
  systemRole?: string | null;
  membershipTier?: string | null;
  provider?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastLoginAt?: string | null;
  permissions?: string[];
  services?: string[];
  pages?: string[];
};

type LoginInput = {
  email: string;
  password: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  ready: boolean;
  loading: boolean;
  userOrigin: string;
  refresh: () => Promise<void>;
  login: (input: LoginInput) => Promise<AuthUser>;
  signOut: () => Promise<void>;
};

type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const body = await userRequest<{ user: AuthUser }>('/api/auth/me');
      setUser(body.user);
    } catch {
      setUser(null);
    } finally {
      setReady(true);
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      loading,
      userOrigin: USER_ORIGIN,
      refresh,
      login: async (input) => {
        setLoading(true);
        try {
          const body = await userRequest<{ user: AuthUser }>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify(input)
          });
          setUser(body.user);
          setReady(true);
          return body.user;
        } finally {
          setLoading(false);
        }
      },
      signOut: async () => {
        setLoading(true);
        try {
          await userRequest<{ ok: true }>('/api/auth/logout', { method: 'POST' });
        } catch {
          // Local state should still be cleared if the remote session is already gone.
        } finally {
          setUser(null);
          setReady(true);
          setLoading(false);
        }
      }
    }),
    [loading, ready, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

async function userRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');

  let response: Response;
  try {
    response = await fetch(userApiUrl(path), {
      ...init,
      headers,
      credentials: 'include'
    });
  } catch (error) {
    throw new Error(isDesktopRuntime() ? 'Desktop app could not reach ChemVault User. Check your network connection and try again.' : error instanceof Error ? error.message : 'ChemVault User request failed.');
  }

  const body = (await response.json().catch(() => null)) as ApiErrorPayload | T | null;

  if (!response.ok) {
    const message = (body as ApiErrorPayload | null)?.error?.message || `Request failed with ${response.status}.`;
    throw new Error(message);
  }

  return body as T;
}

export function userApiUrl(path: string) {
  const safePath = path.startsWith('/') ? path : `/${path}`;
  if (isDesktopRuntime()) return `${DESKTOP_USER_API_PREFIX}${safePath}`;
  return `${USER_ORIGIN}${safePath}`;
}

function isDesktopRuntime() {
  return typeof window !== 'undefined' && Boolean(window.chemVaultDesktop?.isDesktop);
}
