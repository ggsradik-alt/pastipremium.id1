'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Product } from '@/lib/types';
import Link from 'next/link';

interface BuyerSession {
  id: number;
  name: string;
  email: string;
  phone: string;
}

export default function OrderPage() {
  const params = useParams();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [buyer, setBuyer] = useState<BuyerSession | null>(null);
  const [result, setResult] = useState<{ order_number: string; amount: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const session = localStorage.getItem('buyer_session');
    if (!session) {
      router.push(`/buyer/login?redirect=/order/${params.productId}`);
      return;
    }
    setBuyer(JSON.parse(session));

    async function load() {
      const { data } = await supabase.from('products').select('*').eq('id', params.productId).eq('status', 'active').single();
      setProduct(data);
      setLoading(false);
    }
    load();
  }, [params.productId, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!buyer) return;
    setSubmitting(true);
    setError('');

    try {
      const refCode = localStorage.getItem('ref_code') || '';
      const res = await fetch('/api/public/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyer_name: buyer.name,
          buyer_email: buyer.email,
          buyer_phone: buyer.phone,
          product_id: product!.id,
          ref_code: refCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Gagal membuat pesanan'); setSubmitting(false); return; }
      setResult({ order_number: data.order_number, amount: data.amount });
    } catch {
      setError('Terjadi kesalahan koneksi');
      setSubmitting(false);
    }
  }

  function handlePayWithPakasir() {
    if (!result) return;
    // Redirect to Pakasir payment page
    const redirectUrl = `${window.location.origin}/order/success?order=${result.order_number}`;
    const pakasirUrl = `https://app.pakasir.com/pay/pastipremiumid1/${result.amount}?order_id=${result.order_number}&redirect=${encodeURIComponent(redirectUrl)}`;
    window.location.href = pakasirUrl;
  }



  function formatPrice(price: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(price);
  }

  if (loading) return <div className="public-layout"><div className="loading-page"><div className="loading-spinner" /></div></div>;
  if (!product) return <div className="public-layout"><div className="empty-state"><h3>Produk tidak ditemukan</h3><Link href="/" className="btn btn-primary">Kembali</Link></div></div>;

  return (
    <div className="public-layout">
      <header className="public-header" style={{ justifyContent: 'space-between' }}>
        <Link href="/" className="brand">✦ Pasti Premium.id</Link>
        {buyer && (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>👤 {buyer.name}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => { localStorage.removeItem('buyer_session'); router.push('/buyer/login'); }}>Logout</button>
          </div>
        )}
      </header>

      <div className="order-form-container">
        {result ? (
          /* ===== PAYMENT VIA PAKASIR ===== */
          <div className="order-form-card">
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>💳</div>
              <h2 style={{ marginBottom: '8px' }}>Lanjutkan Pembayaran</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Pesanan berhasil dibuat! Silakan lanjutkan pembayaran
              </p>
            </div>

            {/* Order Summary */}
            <div style={{
              background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-primary)', padding: '16px', marginBottom: '24px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Order #{result.order_number}
                </div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{product.name}</div>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--brand-success)' }}>
                {formatPrice(result.amount)}
              </div>
            </div>

            {/* PAKASIR Payment Button */}
            <div style={{ marginBottom: '16px' }}>
              <button
                className="btn btn-primary btn-lg"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  padding: '18px 24px',
                  fontSize: '1rem',
                  background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
                  border: 'none',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onClick={handlePayWithPakasir}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
                  <span style={{ fontSize: '1.3rem' }}>⚡</span>
                  <span>Bayar via QRIS / Virtual Account</span>
                </span>
              </button>
              <div style={{ textAlign: 'center', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--brand-success)', fontWeight: 600 }}>✓ Otomatis</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>— Akun langsung dikirim setelah bayar</span>
              </div>
            </div>

            {/* Supported Methods Icons */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
              padding: '12px', marginBottom: '20px', flexWrap: 'wrap',
            }}>
              {['QRIS', 'BRI', 'BNI', 'CIMB', 'Permata', 'Maybank'].map(m => (
                <span key={m} style={{
                  fontSize: '0.65rem', fontWeight: 700, background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-primary)', borderRadius: '6px',
                  padding: '4px 8px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px',
                }}>{m}</span>
              ))}
            </div>

            {/* Link to check status */}
            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <Link
                href={`/buyer/lookup?order=${result.order_number}`}
                style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'underline' }}
              >
                Bayar nanti? Cek status pesanan →
              </Link>
            </div>
          </div>
        ) : (
          <div className="order-form-card">
            <h2>Konfirmasi Pesanan</h2>
            <div className="order-product-summary">
              <div className="platform" style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--brand-accent)' }}>
                {product.platform_name}
              </div>
              <h4>{product.name}</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                <span className="price">{formatPrice(product.price)}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>/ {product.duration_days} hari</span>
                <span className={`badge ${product.account_type === 'sharing' ? 'badge-info' : 'badge-primary'}`}>{product.account_type}</span>
              </div>
            </div>

            {/* Buyer Info */}
            <div style={{ background: 'rgba(108,92,231,0.06)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)', padding: '16px', marginBottom: '20px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Data Pembeli
              </div>
              <div style={{ display: 'grid', gap: '8px', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Nama</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{buyer?.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Email</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{buyer?.email}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>WhatsApp</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{buyer?.phone}</span>
                </div>
              </div>
            </div>

            {error && <div className="login-error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }} disabled={submitting}>
                {submitting ? <span className="loading-spinner" /> : '🛒 Konfirmasi & Buat Pesanan'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <button
                className="btn btn-secondary btn-sm"
                style={{ background: 'transparent', border: 'none', fontSize: '0.8rem', color: 'var(--text-muted)' }}
                onClick={() => { localStorage.removeItem('buyer_session'); router.push(`/buyer/login?redirect=/order/${product.id}`); }}
              >
                Bukan {buyer?.name}? Ganti akun
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
