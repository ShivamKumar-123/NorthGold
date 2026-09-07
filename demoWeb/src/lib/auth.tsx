import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import * as store from './store';
import type { User } from './types';

const SESSION_KEY = 'ng_demo_session';

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => User;
  register: (input: Parameters<typeof store.register>[0]) => User;
  logout: () => void;
  /** Re-read the current user after an action changed their balances. */
  refresh: () => void;
  /** Alias kept because that is the name the screens were written against. */
  refreshUser: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SESSION_KEY);
    } catch {
      return null;
    }
  });
  const [, force] = useState(0);
  const [loading, setLoading] = useState(true);

  // The store is the single source of truth for balances, so the session
  // holds an id and the user object is always read fresh. Caching the object
  // here is how a stale wallet balance ends up on screen after a payout.
  const user = userId ? store.getUser(userId) : null;

  useEffect(() => {
    // Payouts are credited on load: the demo has no scheduler, so "time
    // passing" is settled by checking every schedule against the clock.
    store.catchUpPayouts();
    setLoading(false);
    return store.subscribe(() => force((n) => n + 1));
  }, []);

  const login = useCallback((email: string, password: string) => {
    const found = store.login(email, password);
    setUserId(found.id);
    try {
      localStorage.setItem(SESSION_KEY, found.id);
    } catch {
      /* session simply will not survive a reload */
    }
    return found;
  }, []);

  const register = useCallback((input: Parameters<typeof store.register>[0]) => {
    const created = store.register(input);
    setUserId(created.id);
    try {
      localStorage.setItem(SESSION_KEY, created.id);
    } catch {
      /* as above */
    }
    return created;
  }, []);

  const logout = useCallback(() => {
    setUserId(null);
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* nothing to clear */
    }
  }, []);

  const refresh = useCallback(() => force((n) => n + 1), []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refresh, refreshUser: refresh }),
    [user, loading, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Redirects to sign-in, preserving where the visitor was headed. */
export function useRequireAuth(staffOnly = false) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate(staffOnly ? '/admin/login' : `/login?next=${encodeURIComponent(location.pathname)}`, {
        replace: true,
      });
      return;
    }
    if (staffOnly && !user.is_staff) {
      navigate('/dashboard', { replace: true });
      return;
    }
    // …and the same rule the other way. In the production build these are two
    // separate applications and the question cannot arise; here they share one
    // session, so a signed-in administrator opening a member screen was shown
    // the administrator's OWN member account — every figure zero, because the
    // desk has no wallet. That reads as the member side being broken rather
    // than as looking at the wrong account.
    if (!staffOnly && user.is_staff) navigate('/admin', { replace: true });
  }, [user, loading, staffOnly, navigate, location.pathname]);

  return { user, loading };
}
