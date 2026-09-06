'use client';

import ReviewQueue from '@/components/ReviewQueue';
import { PageLoader } from '@/components/ui';
import { useRequireAdmin } from '@/lib/auth';

export default function WithdrawalsPage() {
  const { admin, loading } = useRequireAdmin();
  if (loading) return <PageLoader label="Loading withdrawals" />;
  if (!admin) return null;
  return <ReviewQueue kind="withdrawal" />;
}
