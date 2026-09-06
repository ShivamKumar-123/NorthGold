'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowRight, LayoutDashboard, Menu, X } from 'lucide-react';

import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import { useAuth } from '@/lib/auth';

const LINKS = [
  { href: '/calculator#plans', label: 'Plans' },
  { href: '/calculator', label: 'Calculator' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

/**
 * The public, marketing header.
 *
 * Signed-in navigation lives in the sidebar (AppShell); this header only ever
 * appears on the landing page and on publicly browsable routes for signed-out
 * visitors — so it carries marketing links, not app links.
 *
 * Over the hero it is a floating capsule with nothing behind it; once the page
 * scrolls it widens to the full bar and gains a frosted plate. Two states, one
 * element — a separate scrolled header would re-mount the logo and flicker.
 */
export default function Navbar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const onLanding = pathname === '/';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const solid = scrolled || !onLanding || mobileOpen;

  return (
    <header className="sticky top-0 z-50">
      <div
        className={`transition-all duration-500 ${
          solid
            ? 'border-b border-border bg-bg/75 shadow-e2 backdrop-blur-xl'
            : 'border-b border-transparent bg-transparent'
        }`}
      >
        <div
          className={`mx-auto flex max-w-7xl items-center gap-4 px-4 transition-all duration-500 sm:px-6 ${
            solid ? 'h-[74px]' : 'h-[88px]'
          }`}
        >
          <Link
            href="/"
            aria-label="NorthGold — home"
            className="group relative flex shrink-0 items-center"
          >
            {/* Gold bloom behind the mark — the logo is dark-cored, and on the
                hero photo it needs its own light to separate from it. */}
            <span
              className="pointer-events-none absolute -inset-x-4 -inset-y-3 -z-10 rounded-full opacity-0
                         blur-xl transition-opacity duration-500 group-hover:opacity-100"
              style={{ background: 'radial-gradient(circle, rgba(217,166,46,.32), transparent 70%)' }}
              aria-hidden
            />
            <Logo
              className={`transition-all duration-500 ${solid ? 'h-11 sm:h-12' : 'h-12 sm:h-14'}`}
              priority
            />
          </Link>

          {/* Capsule nav. The pill is one rounded container so the links read as
              a single control rather than four loose words. */}
          <nav className="mx-auto hidden items-center gap-0.5 rounded-full border border-border bg-bg-card/50 p-1 backdrop-blur lg:flex">
            {LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="relative rounded-full px-4 py-2 text-sm text-text-muted transition-colors duration-200
                           hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <span
                  className="absolute inset-0 rounded-full bg-accent/10 opacity-0 transition-opacity duration-200 hover:opacity-100"
                  aria-hidden
                />
                <span className="relative">{label}</span>
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <ThemeToggle />

            {user ? (
              <Link href="/dashboard" className="btn-primary px-5 py-2.5">
                <LayoutDashboard size={15} />
                <span className="hidden sm:inline">Dashboard</span>
                <ArrowRight size={15} className="sm:hidden" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden rounded-xl border border-border px-4 py-2.5 text-sm font-medium
                             text-text-muted transition-all duration-200 hover:border-accent/45
                             hover:text-text sm:inline-flex"
                >
                  Sign in
                </Link>
                <Link href="/register" className="btn-primary px-5 py-2.5">
                  <span className="hidden sm:inline">Open account</span>
                  <span className="sm:hidden">Join</span>
                  <ArrowRight size={15} />
                </Link>
              </>
            )}

            <button
              className="rounded-xl border border-border p-2.5 text-text-muted transition hover:text-text lg:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle navigation"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <nav className="animate-fade-up border-b border-border bg-bg-card/95 px-4 py-3 backdrop-blur-xl lg:hidden">
          {LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-between rounded-xl px-3 py-3 text-sm text-text-muted
                         transition hover:bg-accent/10 hover:text-text"
            >
              {label}
              <ArrowRight size={14} className="text-text-faint" />
            </Link>
          ))}
          {!user && (
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="mt-2 block border-t border-border px-3 pt-4 text-sm font-medium text-accent"
            >
              Sign in
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
