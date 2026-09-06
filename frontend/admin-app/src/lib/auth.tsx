'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { api, clearTokens, getAccessToken, setTokens } from './api';
import type { AuthResponse, User } from '@/types';

type AuthState = {
  admin: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refresh = useCallback(async () => {
    if (!getAccessToken()) {
      setAdmin(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<User>('/auth/me/');
      // A non-admin token must never light up this app, even if one is somehow
      // present in this origin's storage.
      setAdmin(me.role === 'admin' || me.role === 'superadmin' ? me : null);
    } catch {
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    // The dedicated admin-login route rejects non-staff before minting a token.
    const res = await api.post<AuthResponse>(
      '/auth/admin-login/',
      { email, password },
      { auth: false },
    );
    setTokens(res.tokens.access, res.tokens.refresh);
    setAdmin(res.user);
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setAdmin(null);
    router.push('/login');
  }, [router]);

  const value = useMemo(
    () => ({ admin, loading, login, logout, refresh }),
    [admin, loading, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function useRequireAdmin() {
  const { admin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !admin) router.replace('/login');
  }, [loading, admin, router]);

  return { admin, loading };
}
