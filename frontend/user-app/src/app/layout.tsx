import type { Metadata, Viewport } from 'next';

import Chrome from '@/components/Chrome';
import WelcomeGate from '@/components/WelcomeGate';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider, themeScript } from '@/lib/theme';

import './globals.css';

export const metadata: Metadata = {
  title: 'NorthGold — Fixed-income instruments with monthly returns',
  description:
    'Invest in partner-bank instruments, receive a contracted monthly return, and earn referral commission across your whole network.',
  // `icon.png`, `apple-icon.png` and `favicon.ico` sit in this directory and
  // the App Router emits their <link> tags itself — only the manifest and the
  // browser-chrome colour need declaring.
  manifest: '/site.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#f7f5f0',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `suppressHydrationWarning` because the script below mutates the class on
    // <html> before React hydrates; without it React reports a mismatch on
    // every load for a difference that is intentional.
    <html lang="en" className="light" suppressHydrationWarning>
      <head>
        {/* Runs synchronously, before first paint. Anything later — including
            a useEffect — lands after the browser has already painted, which is
            exactly the white flash this exists to prevent. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      {/* Chrome picks the layout: marketing header on the landing and auth
          pages, application sidebar once signed in. */}
      <body className="min-h-screen">
        <ThemeProvider>
          <AuthProvider>
            <WelcomeGate />
            <Chrome>{children}</Chrome>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
