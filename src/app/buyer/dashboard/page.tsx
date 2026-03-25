'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BuyerDashboardPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the lookup page (which is the new dashboard)
    const session = localStorage.getItem('buyer_session');
    if (session) {
      router.replace('/buyer/lookup');
    } else {
      router.replace('/buyer/login?redirect=/buyer/lookup');
    }
  }, [router]);

  return (
    <div className="public-layout">
      <div className="loading-page"><div className="loading-spinner" /></div>
    </div>
  );
}
