'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { api, clearTokens, getAccessToken, setTokens } from './api';
import type { AuthResponse, User } from '@/types';

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

export type RegisterPayload = {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  country?: string;
  referral_code?: string;
  /** Which identity document the two ID pages are. Asked once, stored on both. */
  proofType: string;
  /** doc_type -> file, keyed by `KYC_DOC_TYPES`. The API refuses a signup that
   *  is missing any of them, so the account and the documents it was opened
   *  against are always created together. */
  documents: Record<string, File>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setUser(await api.get<User>('/auth/me/'));
    } catch {
      // api.ts already redirects on an unrecoverable 401; treat anything else
      // as "not signed in" rather than leaving a half-authenticated shell.
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<AuthResponse>('/auth/login/', { email, password }, { auth: false });
    setTokens(res.tokens.access, res.tokens.refresh);
    setUser(res.user);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    // Multipart rather than JSON: the identity documents go up with the rest
    // of the form, in the one request that creates the account.
    const { documents, proofType, ...fields } = payload;
    const form = new FormData();
    Object.entries(fields).forEach(([key, value]) => {
      if (value) form.append(key, value);
    });
    // The API field is snake_case; the prop is not, so it is mapped rather
    // than spread with the rest.
    form.append('proof_type', proofType);
    Object.entries(documents).forEach(([docType, file]) => form.append(docType, file));

    const res = await api.postForm<AuthResponse>('/auth/register/', form, { auth: false });
    setTokens(res.tokens.access, res.tokens.refresh);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    router.push('/login');
  }, [router]);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser }),
    [user, loading, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Redirects to /login once the auth check settles without a user. */
export function useRequireAuth() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  return { user, loading };
}
