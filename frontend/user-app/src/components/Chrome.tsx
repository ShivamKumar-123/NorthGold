'use client';

import { usePathname } from 'next/navigation';

import AppShell from '@/components/AppShell';
import Footer from '@/components/Footer';
import Navbar from '@/components/Navbar';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';

// Public pages: header + footer, signed in or not. These are not "the app",
// so wrapping them in the application sidebar would be wrong even for a
// logged-in visitor.
const MARKETING_ROUTES = new Set(['/', '/about', '/contact']);

// Sign-in and sign-up are standalone screens that bring their own chrome
// (AuthLayout). Rendering the site header and footer around them would give
// someone mid-signup a dozen ways to wander off the form.
const AUTH_ROUTES = new Set(['/login', '/register']);

export default function Chrome({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  if (AUTH_ROUTES.has(pathname)) return <>{children}</>;

  if (MARKETING_ROUTES.has(pathname)) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    );
  }

  // Signed in, inside the app → sidebar.
  if (user) return <AppShell>{children}</AppShell>;

  // Auth is still resolving. Render a neutral placeholder rather than the
  // marketing header, which would otherwise flash for a second on every hard
  // refresh of an app route before the sidebar takes over.
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  // Signed out but on a publicly browsable app route.
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
