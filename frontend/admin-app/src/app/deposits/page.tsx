'use client';

import ReviewQueue from '@/components/ReviewQueue';
import { PageLoader } from '@/components/ui';
import { useRequireAdmin } from '@/lib/auth';

export default function DepositsPage() {
  const { admin, loading } = useRequireAdmin();
  if (loading) return <PageLoader label="Loading deposits" />;
  if (!admin) return null;
  return <ReviewQueue kind="deposit" />;
}
