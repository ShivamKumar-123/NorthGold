import { Outlet } from 'react-router-dom';

import Footer from '@/components/Footer';
import Navbar from '@/components/Navbar';

/** Header + footer, signed in or not. The landing, About and Contact are not
 *  "the app", so wrapping them in the application sidebar would be wrong even
 *  for a logged-in visitor. */
export default function MarketingLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
