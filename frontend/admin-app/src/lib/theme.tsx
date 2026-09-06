'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'ng_theme';

type ThemeState = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeState | null>(null);

/**
 * Blocking script injected in <head>.
 *
 * The theme class has to be on <html> BEFORE first paint, otherwise a
 * dark-mode visitor gets a white flash on every navigation. React cannot do
 * this — it runs after paint — so this one runs synchronously.
 */
export const themeScript = `(function(){try{
var s=localStorage.getItem('${STORAGE_KEY}');
var t=s==='light'||s==='dark'?s:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');
var e=document.documentElement;
e.classList.toggle('dark',t==='dark');e.classList.toggle('light',t==='light');
e.style.colorScheme=t;
}catch(e){document.documentElement.classList.add('dark');}})();`;

function apply(theme: Theme) {
  const el = document.documentElement;
  el.classList.toggle('dark', theme === 'dark');
  el.classList.toggle('light', theme === 'light');
  el.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Seeded from the class the blocking script already set, so the first React
  // render agrees with the DOM and never causes a hydration flip.
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    setThemeState(document.documentElement.classList.contains('light') ? 'light' : 'dark');
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    apply(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode — the choice just won't persist */
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme(document.documentElement.classList.contains('light') ? 'dark' : 'light');
  }, [setTheme]);

  const value = useMemo(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
