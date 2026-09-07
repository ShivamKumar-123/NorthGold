'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowRight, LayoutDashboard } from 'lucide-react';

import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import { useAuth } from '@/lib/auth';

/**
 * The public, marketing header.
 *
 * It carries the brand, the theme toggle and the way in — nothing else. The
 * marketing links it used to hold live in the footer now, which is also why
 * there is no mobile sheet any more: with no navigation left to reveal, a
 * hamburger would open onto a single "Sign in" that already fits in the bar.
 *
 * Over the hero it is a floating capsule with nothing behind it; once the page
 * scrolls it widens to the full bar and gains a frosted plate. Two states, one
 * element — a separate scrolled header would re-mount the logo and flicker.
 */
export default function Navbar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  const onLanding = pathname === '/';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const solid = scrolled || !onLanding;

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

          <div className="ml-auto flex items-center gap-2">
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
          </div>
        </div>
      </div>
    </header>
  );
}
