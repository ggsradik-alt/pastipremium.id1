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

interface PaymentMethod {
  id: string;
  provider: string;
  account_name: string;
  account_number: string;
  description: string;
}

export default function OrderPage() {
  const params = useParams();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [buyer, setBuyer] = useState<BuyerSession | null>(null);
  const [result, setResult] = useState<{ order_number: string; amount: number } | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [uploadDone, setUploadDone] = useState(false);
  const [error, setError] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  useEffect(() => {
    const session = localStorage.getItem('buyer_session');
    if (!session) {
      router.push(`/buyer/login?redirect=/order/${params.productId}`);
      return;
    }
    setBuyer(JSON.parse(session));

    async function load() {
      const { data } = await supabase.from('products').select('*').eq('id', params.productId).eq('status', 'active').single();
      const { data: methods } = await supabase.from('payment_methods').select('*').eq('is_active', true);
      
      setProduct(data);
      if (methods) setPaymentMethods(methods);
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate (Bebas format gambar/PDF iOS/Android)
    if (file.size > 15 * 1024 * 1024) {
      setError('Ukuran file maksimal 15MB');
      return;
    }

    setProofFile(file);
    setError('');
    // Preview
    const reader = new FileReader();
    reader.onload = () => setProofPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleUploadProof() {
    if (!proofFile || !result) return;
    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', proofFile);
      formData.append('order_number', result.order_number);

      const res = await fetch('/api/orders/upload-proof', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setUploadDone(true);
      } else {
        setError(data.error || 'Gagal upload bukti');
      }
    } catch {
      setError('Terjadi kesalahan koneksi');
    }
    setUploading(false);
  }

  function copyToClipboard(text: string, index: number) {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
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
          uploadDone ? (
            /* ===== UPLOAD SUCCESS ===== */
            <div className="order-form-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✅</div>
              <h2>Bukti Pembayaran Terkirim!</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
                Admin sedang memverifikasi pembayaran Anda. Proses biasanya memakan waktu <strong>5-15 menit</strong>.
              </p>
              <div className="order-product-summary">
                <div className="form-label">Nomor Pesanan</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--brand-accent)' }}>
                  {result.order_number}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '20px' }}>
                <Link href={`/buyer/lookup?order=${result.order_number}`} className="btn btn-primary">📋 Cek Status Pesanan</Link>
                <Link href="/" className="btn btn-secondary">Kembali</Link>
              </div>
            </div>
          ) : (
            /* ===== PAYMENT INSTRUCTION + UPLOAD ===== */
            <div className="order-form-card">
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>💳</div>
                <h2 style={{ marginBottom: '8px' }}>Lakukan Pembayaran</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Transfer ke salah satu rekening di bawah, lalu upload bukti transfer
                </p>
              </div>

              {/* Order Summary */}
              <div style={{
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-primary)',
                padding: '16px',
                marginBottom: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
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

              {/* Bank Accounts */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  💰 Transfer ke Salah Satu Rekening
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {paymentMethods.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)' }}>Belum ada metode pembayaran tersedia</div>
                  ) : (
                    paymentMethods.map((acc, i) => (
                      <div key={i} style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-secondary)',
                        borderRadius: 'var(--radius-md)',
                        padding: '14px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                        <div>
                          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '2px' }}>
                            {acc.provider}
                          </div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)', letterSpacing: '1px' }}>
                            {acc.account_number}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            a.n. {acc.account_name} {acc.description ? `(${acc.description})` : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => copyToClipboard(acc.account_number, i)}
                          style={{ minWidth: '72px', justifyContent: 'center' }}
                        >
                          {copiedIndex === i ? '✅ Copied' : '📋 Copy'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Important Notice */}
              <div style={{
                background: 'rgba(234,179,8,0.08)',
                border: '1px solid rgba(234,179,8,0.2)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                marginBottom: '24px',
                fontSize: '0.8rem',
                color: '#eab308',
              }}>
                ⚠️ <strong>Penting:</strong> Transfer tepat <strong>{formatPrice(result.amount)}</strong>. Pastikan nominal sama persis agar verifikasi lebih cepat.
              </div>

              {/* Upload Section */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  📸 Upload Bukti Transfer
                </div>

                {!proofPreview ? (
                  <label style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px dashed var(--border-primary)',
                    borderRadius: 'var(--radius-md)',
                    padding: '32px',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s, background 0.2s',
                    background: 'var(--bg-secondary)',
                  }}
                  onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; }}
                  onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-primary)'; }}
                  >
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📷</div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Klik untuk pilih foto</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Semua Format Foto / PDF — Maks 15MB</div>
                    <input
                      type="file"
                      accept="image/*,.heic,.pdf"
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                    />
                  </label>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <img
                      src={proofPreview}
                      alt="Bukti Transfer"
                      style={{
                        width: '100%',
                        maxHeight: '300px',
                        objectFit: 'contain',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-secondary)',
                        background: 'var(--bg-card)',
                      }}
                    />
                    <button
                      onClick={() => { setProofFile(null); setProofPreview(null); }}
                      style={{
                        position: 'absolute', top: '8px', right: '8px',
                        background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none',
                        borderRadius: '50%', width: '28px', height: '28px',
                        cursor: 'pointer', fontSize: '0.8rem', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >✕</button>
                  </div>
                )}
              </div>

              {error && <div className="login-error">{error}</div>}

              <button
                className="btn btn-primary btn-lg"
                style={{ width: '100%', justifyContent: 'center', opacity: proofFile ? 1 : 0.5 }}
                disabled={!proofFile || uploading}
                onClick={handleUploadProof}
              >
                {uploading ? <span className="loading-spinner" /> : '📤 Kirim Bukti Pembayaran'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <Link
                  href={`/buyer/lookup?order=${result.order_number}`}
                  style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'underline' }}
                >
                  Upload nanti? Cek status pesanan →
                </Link>
              </div>
            </div>
          )
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
