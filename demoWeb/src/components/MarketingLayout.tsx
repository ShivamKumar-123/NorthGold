import { Outlet } from 'react-router-dom';

import Footer from '@/components/Footer';
import HowItWorksModal from '@/components/HowItWorksModal';
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
      {/* Only on the marketing pages. It explains the offer, so opening it
          over a sign-in form or the dashboard is an interruption, not help. */}
      <HowItWorksModal />
    </div>
  );
}
