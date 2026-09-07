import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import AppShell from '@/components/AppShell';
import MarketingLayout from '@/components/MarketingLayout';
import ScrollManager from '@/components/ScrollManager';
import WelcomeGate from '@/components/WelcomeGate';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';

import About from '@/pages/About';
import Contact from '@/pages/Contact';
import Dashboard from '@/pages/Dashboard';
import Investments from '@/pages/Investments';
import Kyc from '@/pages/Kyc';
import Calculator from '@/pages/Calculator';
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import NotFound from '@/pages/NotFound';
import Profile from '@/pages/Profile';
import Referrals from '@/pages/Referrals';
import Support from '@/pages/Support';
import Register from '@/pages/Register';
import Wallet from '@/pages/Wallet';

import AdminShell from '@/pages/admin/AdminShell';
import AdminChannels from '@/pages/admin/Channels';
import AdminDashboard from '@/pages/admin/Dashboard';
import AdminDeposits from '@/pages/admin/Deposits';
import AdminKyc from '@/pages/admin/Kyc';
import AdminLevels from '@/pages/admin/Levels';
import AdminLogin from '@/pages/admin/Login';
import AdminMessages from '@/pages/admin/Messages';
import AdminPlans from '@/pages/admin/Plans';
import AdminSettings from '@/pages/admin/Settings';
import AdminUsers from '@/pages/admin/Users';
import AdminWithdrawals from '@/pages/admin/Withdrawals';

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ScrollManager />
          <WelcomeGate />
          <Routes>
            {/* Public: header + footer. */}
            <Route element={<MarketingLayout />}>
              <Route path="/" element={<Landing />} />
              <Route path="/calculator" element={<Calculator />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
            </Route>

            {/* Auth screens bring their own chrome — no header, no footer, and
                nothing else to click away to mid-signup. */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* The signed-in application. */}
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/wallet" element={<Wallet />} />
              <Route path="/investments" element={<Investments />} />
              <Route path="/referrals" element={<Referrals />} />
              <Route path="/kyc" element={<Kyc />} />
              <Route path="/support" element={<Support />} />
              <Route path="/profile" element={<Profile />} />
            </Route>

            {/* The admin panel. A second app in the production build; here it
                is a route tree, which keeps one store and one session. */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminShell />}>
              <Route index element={<AdminDashboard />} />
              <Route path="deposits" element={<AdminDeposits />} />
              <Route path="withdrawals" element={<AdminWithdrawals />} />
              <Route path="kyc" element={<AdminKyc />} />
              <Route path="messages" element={<AdminMessages />} />
              <Route path="plans" element={<AdminPlans />} />
              <Route path="levels" element={<AdminLevels />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="channels" element={<AdminChannels />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>

            <Route path="/instruments" element={<Navigate to="/calculator#plans" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
