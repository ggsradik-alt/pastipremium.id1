'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function BuyerLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Find existing buyer by email
      let { data: existing } = await supabase
        .from('buyers')
        .select('*')
        .eq('email', form.email.trim().toLowerCase())
        .single();

      if (existing) {
        // Update name & phone if changed
        if (existing.name !== form.name.trim() || existing.phone !== form.phone.trim()) {
          await supabase.from('buyers').update({
            name: form.name.trim(),
            phone: form.phone.trim(),
            updated_at: new Date().toISOString(),
          }).eq('id', existing.id);
          existing.name = form.name.trim();
          existing.phone = form.phone.trim();
        }
      } else {
        // Create new buyer
        const now = new Date().toISOString();
        const { data: newBuyer, error: createErr } = await supabase
          .from('buyers')
          .insert({
            name: form.name.trim(),
            email: form.email.trim().toLowerCase(),
            phone: form.phone.trim(),
            status: 'active',
            created_at: now,
            updated_at: now,
          })
          .select()
          .single();

        if (createErr) {
          setError('Gagal membuat akun buyer: ' + createErr.message);
          setLoading(false);
          return;
        }
        existing = newBuyer;
      }

      // Save session to localStorage
      localStorage.setItem('buyer_session', JSON.stringify({
        id: existing.id,
        name: existing.name,
        email: existing.email,
        phone: existing.phone,
      }));

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
        <Link href="/" className="brand">✦ Pasti Premium.id</Link>
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
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="john@example.com"
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
