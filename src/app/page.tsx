'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Product } from '@/lib/types';
import Link from 'next/link';

interface BuyerSession {
  id: number;
  name: string;
  email: string;
  phone: string;
}

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyer, setBuyer] = useState<BuyerSession | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
    // Check buyer session
    const session = localStorage.getItem('buyer_session');
    if (session) {
      setBuyer(JSON.parse(session));
    }

    // Capture referral code from URL (?ref=CODE)
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      localStorage.setItem('ref_code', ref.toUpperCase());
    }
  }, []);

  async function loadProducts() {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('status', 'active')
      .order('platform_name', { ascending: true });
    setProducts(data || []);
    setLoading(false);
  }

  function formatPrice(price: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(price);
  }

  function handleLogout() {
    localStorage.removeItem('buyer_session');
    setBuyer(null);
  }

  return (
    <div className="public-layout">
      <header className="public-header" style={{ justifyContent: 'space-between' }}>
        <span className="brand">✦ Pasti Premium.id</span>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {buyer ? (
            <>
              <Link href="/buyer/lookup" className="btn btn-secondary btn-sm" style={{ backgroundColor: 'transparent', border: 'none' }}>📦 Pesanan Saya</Link>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>👤 {buyer.name}</span>
              <button className="btn btn-secondary btn-sm" onClick={handleLogout}>Logout</button>
            </>
          ) : (
            <>
              <Link href="/buyer/login" className="btn btn-primary btn-sm">Login / Daftar</Link>
            </>
          )}
        </div>
      </header>

      <section className="public-hero">
        <h1>Premium Accounts<br /><span>Instant Delivery</span></h1>
        <p>Dapatkan akun premium favorit kamu dengan harga terbaik. Akun dikirim otomatis setelah pembayaran berhasil.</p>
      </section>

      {loading ? (
        <div className="loading-page"><div className="loading-spinner" /></div>
      ) : products.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📦</div>
          <h3>Belum ada produk</h3>
          <p>Produk akan segera tersedia. Stay tuned!</p>
        </div>
      ) : !selectedCategory ? (
        <div className="products-grid">
          {Array.from(new Set(products.map(p => p.platform_name))).map(category => {
            const count = products.filter(p => p.platform_name === category).length;
            return (
              <div 
                key={category} 
                className="product-card" 
                style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '32px 24px' }}
                onClick={() => setSelectedCategory(category)}
              >
                <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', marginBottom: '16px', fontWeight: 'bold' }}>
                  {category.charAt(0)}
                </div>
                <h3 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>{category}</h3>
                <span className="badge badge-neutral" style={{ padding: '6px 12px' }}>{count} Varian Paket</span>
                
                <div style={{ marginTop: '24px', width: '100%' }}>
                  <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Lihat Paket</button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 32px 10px', display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
            <button 
              className="btn btn-secondary" 
              onClick={() => setSelectedCategory(null)}
              style={{ padding: '8px 16px' }}
            >
              ← Kembali
            </button>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Varian {selectedCategory}</h2>
          </div>
          <div className="products-grid">
            {products.filter(p => p.platform_name === selectedCategory).map(product => (
              <div key={product.id} className="product-card">
                <div className="platform">{product.platform_name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', marginBottom: '8px' }}>{product.name}</h3>
                </div>
                {product.description && <p className="desc">{product.description}</p>}
                <div className="meta">
                  <span className="price">{formatPrice(product.price)}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="duration">/ {product.duration_days} hari</span>
                    <span className={`badge ${product.account_type === 'sharing' ? 'badge-info' : 'badge-primary'}`}>
                      {product.account_type}
                    </span>
                  </div>
                </div>
                <Link 
                  href={`/order/${product.id}`} 
                  className="btn btn-primary" 
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Beli Sekarang
                </Link>
              </div>
            ))}
          </div>
        </>
      )}

      <footer style={{ textAlign: 'center', padding: '40px 20px', borderTop: '1px solid var(--border-secondary)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        <p>© 2024 Pasti Premium.id. All rights reserved.</p>
      </footer>
    </div>
  );
}
