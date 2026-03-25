'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const navItems = [
  { label: 'Dashboard', href: '/admin', icon: '📊' },
  { section: 'Katalog' },
  { label: 'Produk', href: '/admin/products', icon: '📦' },
  { label: 'Stok Akun', href: '/admin/stock-accounts', icon: '🔑' },
  { section: 'Transaksi' },
  { label: 'Pesanan', href: '/admin/orders', icon: '🛒' },
  { label: 'Assignment', href: '/admin/assignments', icon: '🔗' },
  { section: 'Manajemen' },
  { label: 'Buyer', href: '/admin/buyers', icon: '👥' },
  { label: 'Support Tickets', href: '/admin/support', icon: '🎫' },
  { label: 'Audit Logs', href: '/admin/audit-logs', icon: '📋' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [admin, setAdmin] = useState<{ name: string; role: string } | null>(null);

  useEffect(() => {
    const session = localStorage.getItem('admin_session');
    if (!session && pathname !== '/admin/login') {
      router.push('/admin/login');
      return;
    }
    if (session) {
      setAdmin(JSON.parse(session));
    }
  }, [pathname, router]);

  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  if (!admin) {
    return <div className="loading-page"><div className="loading-spinner" /></div>;
  }

  async function handleLogout() {
    localStorage.removeItem('admin_session');
    await supabase.auth.signOut();
    router.push('/admin/login');
  }

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <h1>✦ Pasti Premium.id</h1>
          <p>Admin Dashboard</p>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item, i) => {
            if ('section' in item) {
              return <div key={i} className="sidebar-section">{item.section}</div>;
            }
            const isActive = item.href === '/admin' 
              ? pathname === '/admin' 
              : pathname.startsWith(item.href!);
            return (
              <Link
                key={i}
                href={item.href!}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
              >
                <span className="icon">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-secondary)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{admin.name}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '12px' }}>{admin.role}</div>
          <button onClick={handleLogout} className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
            Logout
          </button>
        </div>
      </aside>
      <main className="admin-main">
        {children}
      </main>
    </div>
  );
}
