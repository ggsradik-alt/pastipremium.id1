'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function BuyerLoginPageWrapper() {
  return (
    <Suspense fallback={<div className="public-layout"><div className="loading-page"><div className="loading-spinner" /></div></div>}>
      <BuyerLoginPage />
    </Suspense>
  );
}

function BuyerLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/buyer/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), phone: form.phone.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login gagal');
        setLoading(false);
        return;
      }

      // Store JWT token + buyer session
      if (data.token) {
        localStorage.setItem('buyer_token', data.token);
      }
      localStorage.setItem('buyer_session', JSON.stringify(data.buyer));

      // Redirect
      router.push(redirect);
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.');
      setLoading(false);
    }
  }

  return (
    <div className="public-layout">
      <header className="public-header">
        <Link href="/" className="brand">✦ pastipremium.store</Link>
      </header>

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <div className="order-form-card" style={{ maxWidth: '440px', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>👤</div>
            <h2 style={{ marginBottom: '8px' }}>Login / Daftar Buyer</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Masukkan data diri Anda untuk melanjutkan pembelian dan melacak pesanan.
            </p>
          </div>

          {error && <div className="login-error">{error}</div>}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Nama Lengkap</label>
              <input
                className="form-input"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Contoh: John Doe"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">No. WhatsApp</label>
              <input
                className="form-input"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="08123456789"
                required
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Nomor ini akan digunakan untuk mengirim detail akun Anda via WhatsApp.
              </p>
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={loading}
            >
              {loading ? <span className="loading-spinner" /> : '🚀 Masuk & Lanjutkan'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Data Anda aman dan hanya digunakan untuk keperluan transaksi.
          </div>
        </div>
      </div>
    </div>
  );
}
