import type { Metadata, Viewport } from 'next';

import Shell from '@/components/Shell';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider, themeScript } from '@/lib/theme';

import './globals.css';

export const metadata: Metadata = {
  title: 'NorthGold — Admin',
  description: 'Verify deposits and withdrawals, configure ROI plans and MLM levels.',
  robots: { index: false, follow: false },
  // `icon.png`, `apple-icon.png` and `favicon.ico` sit in this directory and
  // the App Router emits their <link> tags itself. No manifest here: the panel
  // is staff-only and noindex, so there is nothing to install.
};

export const viewport: Viewport = {
  themeColor: '#080808',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `suppressHydrationWarning` because the script below mutates the class on
    // <html> before React hydrates; without it React reports a mismatch on
    // every load for a difference that is intentional.
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* Runs synchronously, before first paint — a useEffect would land
            after the browser has already painted the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen">
        <ThemeProvider>
          <AuthProvider>
            <Shell>{children}</Shell>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
