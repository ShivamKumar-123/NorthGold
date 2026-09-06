'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { PageLoader } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function IndexPage() {
  const { admin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(admin ? '/dashboard' : '/login');
  }, [admin, loading, router]);

  return <PageLoader label="Loading admin panel" />;
}
