'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface BuyerSession {
  id: number;
  name: string;
  email: string;
  phone: string;
}

export default function BuyerLookupPageWrapper() {
  return (
    <Suspense fallback={<div className="public-layout"><div className="loading-page"><div className="loading-spinner" /></div></div>}>
      <BuyerLookupPage />
    </Suspense>
  );
}

function BuyerLookupPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [buyer, setBuyer] = useState<BuyerSession | null>(null);
  const [orderNumber, setOrderNumber] = useState(searchParams.get('order') || '');
  const [orders, setOrders] = useState<Array<Record<string, unknown>>>([]);
  const [selectedOrder, setSelectedOrder] = useState<Record<string, unknown> | null>(null);
  const [assignments, setAssignments] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const session = localStorage.getItem('buyer_session');
    if (!session) {
      router.push('/buyer/login?redirect=/buyer/lookup');
      return;
    }
    const parsed = JSON.parse(session);
    setBuyer(parsed);
    loadAllOrders(parsed.email);
  }, [router]);

  useEffect(() => {
    if (searchParams.get('order') && orders.length > 0) {
      const found = orders.find((o: any) => o.order_number === searchParams.get('order'));
      if (found) {
        selectOrder(found);
      }
    }
  }, [orders, searchParams]);

  async function loadAllOrders(email: string) {
    setLoading(true);
    // Find buyer by email
    const { data: buyerData } = await supabase
      .from('buyers')
      .select('id')
      .eq('email', email)
      .single();

    if (!buyerData) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const { data: orderData } = await supabase
      .from('orders')
      .select('*, product:products(*)')
      .eq('buyer_id', buyerData.id)
      .order('created_at', { ascending: false });

    setOrders(orderData || []);
    setLoading(false);
  }

  async function selectOrder(order: Record<string, unknown>) {
    setSelectedOrder(order);
    // Load assignments for this order
    const { data: assignData } = await supabase
      .from('account_assignments')
      .select('*, stock_account:stock_accounts(*)')
      .eq('order_id', order.id)
      .eq('status', 'active');
    setAssignments(assignData || []);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!orderNumber.trim()) return;
    setSearching(true);
    setError('');

    const found = orders.find((o: any) => o.order_number === orderNumber.trim());
    if (found) {
      selectOrder(found);
    } else {
      setError('Pesanan tidak ditemukan di akun Anda.');
      setSelectedOrder(null);
    }
    setSearching(false);
  }

  function handleProofFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) { setError('Format file harus JPG, PNG, atau WebP'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Ukuran file maksimal 5MB'); return; }
    setProofFile(file);
    setError('');
    const reader = new FileReader();
    reader.onload = () => setProofPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleUploadProof() {
    if (!proofFile || !selectedOrder) return;
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', proofFile);
      formData.append('order_number', selectedOrder.order_number as string);
      const res = await fetch('/api/orders/upload-proof', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        alert('Bukti pembayaran berhasil diupload! Admin akan segera memverifikasi.');
        setProofFile(null);
        setProofPreview(null);
        // Reload
        if (buyer) {
          await loadAllOrders(buyer.email);
          const { data: updatedOrder } = await supabase.from('orders').select('*, product:products(*)').eq('order_number', selectedOrder.order_number).single();
          if (updatedOrder) {
            setSelectedOrder(updatedOrder);
          }
        }
      } else {
        setError(data.error || 'Gagal upload');
      }
    } catch { setError('Terjadi kesalahan jaringan.'); }
    setUploading(false);
  }

  function formatPrice(price: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(price);
  }

  function getStatusBadge(status: string) {
    const map: Record<string, string> = {
      pending: 'badge-neutral', paid: 'badge-info', assigned: 'badge-primary',
      delivered: 'badge-success', completed: 'badge-success', cancelled: 'badge-danger',
      refunded: 'badge-warning', pending_payment: 'badge-neutral', failed: 'badge-danger',
    };
    return map[status] || 'badge-neutral';
  }

  const statusSteps = ['pending', 'paid', 'assigned', 'delivered', 'completed'];
  const currentStatusIndex = selectedOrder ? statusSteps.indexOf(selectedOrder.order_status as string) : -1;

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

      <div className="status-container">
        <div style={{ marginBottom: '16px' }}>
          <Link href="/" className="btn btn-secondary" style={{ display: 'inline-flex', gap: '8px', padding: '8px 16px', fontSize: '0.9rem', borderRadius: 'var(--radius-full)' }}>
            <span>←</span> Kembali ke Beranda
          </Link>
        </div>

        {/* Search bar */}
        <div className="status-card" style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '16px' }}>Pesanan Saya</h2>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
            <input
              className="form-input"
              value={orderNumber}
              onChange={e => setOrderNumber(e.target.value)}
              placeholder="Cari nomor pesanan (ORD-XXXXXXXX-XXXX)"
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn-primary" disabled={searching}>
              {searching ? <span className="loading-spinner" /> : 'Cari'}
            </button>
          </form>
          {error && <div className="login-error" style={{ marginTop: '8px' }}>{error}</div>}
        </div>

        {/* Order Detail View */}
        {selectedOrder && (
          <div className="status-card" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setSelectedOrder(null); setAssignments([]); }}
                  style={{ marginBottom: '8px', background: 'transparent', border: 'none', padding: 0, color: 'var(--brand-primary-light)', fontSize: '0.85rem' }}
                >
                  ← Kembali ke Daftar
                </button>
                <div style={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 700, color: 'var(--brand-primary-light)' }}>
                  {selectedOrder.order_number as string}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {new Date(selectedOrder.created_at as string).toLocaleString('id-ID')}
                </div>
              </div>
              <span className={`badge ${getStatusBadge(selectedOrder.order_status as string)}`} style={{ fontSize: '0.8rem' }}>
                {selectedOrder.order_status as string}
              </span>
            </div>

            <div style={{ display: 'grid', gap: '8px', marginBottom: '20px' }}>
              <div><span className="form-label">Produk:</span> <span style={{ color: 'var(--text-primary)' }}>{((selectedOrder.product as Record<string, unknown>)?.name as string) || '-'}</span></div>
              <div><span className="form-label">Total:</span> <span style={{ color: 'var(--brand-success)', fontWeight: 700 }}>{formatPrice(selectedOrder.total_amount as number)}</span></div>
              <div><span className="form-label">Payment:</span> <span className={`badge ${getStatusBadge(selectedOrder.payment_status as string)}`}>{selectedOrder.payment_status as string}</span></div>
            </div>

            {/* Upload Bukti Transfer untuk pesanan pending */}
            {(selectedOrder.payment_status === 'pending_payment' || selectedOrder.payment_status === 'pending') && (
              <div style={{ background: 'var(--bg-secondary)', border: '1px dashed var(--border-primary)', borderRadius: 'var(--radius-md)', padding: '20px', marginBottom: '24px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  📸 Upload Bukti Transfer
                </div>
                {!proofPreview ? (
                  <label style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    border: '2px dashed var(--border-primary)', borderRadius: 'var(--radius-md)',
                    padding: '24px', cursor: 'pointer', background: 'var(--bg-card)',
                  }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>📷</div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>Klik untuk pilih foto</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>JPG, PNG, WebP — Maks 5MB</div>
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleProofFile} style={{ display: 'none' }} />
                  </label>
                ) : (
                  <div style={{ position: 'relative', marginBottom: '12px' }}>
                    <img src={proofPreview} alt="Bukti" style={{ width: '100%', maxHeight: '250px', objectFit: 'contain', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-secondary)' }} />
                    <button onClick={() => { setProofFile(null); setProofPreview(null); }} style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer' }}>✕</button>
                  </div>
                )}
                {error && <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '8px' }}>{error}</div>}
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '12px', opacity: proofFile ? 1 : 0.5 }} disabled={!proofFile || uploading} onClick={handleUploadProof}>
                  {uploading ? <span className="loading-spinner" /> : '📤 Kirim Bukti Pembayaran'}
                </button>
              </div>
            )}

            {/* Waiting confirmation status */}
            {selectedOrder.payment_status === 'waiting_confirmation' && (
              <div style={{
                background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)',
                borderRadius: 'var(--radius-md)', padding: '20px', marginBottom: '24px', textAlign: 'center',
              }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>⏳</div>
                <div style={{ fontWeight: 700, color: '#eab308', marginBottom: '4px' }}>Menunggu Verifikasi Admin</div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Bukti pembayaran telah diterima. Admin sedang memverifikasi, biasanya 5-15 menit.
                </p>
              </div>
            )}

            {/* Status Timeline */}
            <div className="status-timeline">
              <h4 style={{ marginBottom: '12px', fontSize: '0.9rem', fontWeight: 700 }}>Progress</h4>
              {statusSteps.map((step, i) => (
                <div key={step} className="timeline-item">
                  <div className={`timeline-dot ${i < currentStatusIndex ? 'active' : i === currentStatusIndex ? 'current' : ''}`} />
                  <div>
                    <div style={{ fontWeight: 600, textTransform: 'capitalize', color: i <= currentStatusIndex ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {step === 'pending' ? 'Menunggu Pembayaran' :
                       step === 'paid' ? 'Pembayaran Diterima' :
                       step === 'assigned' ? 'Akun Disiapkan' :
                       step === 'delivered' ? 'Akun Terkirim' :
                       'Selesai'}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Account Details */}
            {assignments.length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <h4 style={{ marginBottom: '12px', fontSize: '0.9rem', fontWeight: 700 }}>Detail Akun</h4>
                {assignments.map((a, i) => {
                  const stock = a.stock_account as Record<string, unknown>;
                  return (
                    <div key={i} className="assignment-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <span className={`badge ${(a.status as string) === 'active' ? 'badge-success' : 'badge-neutral'}`}>{a.status as string}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Expired: {new Date(a.expired_at as string).toLocaleDateString('id-ID')}
                        </span>
                      </div>
                      <div className="credential-field">
                        <div>
                          <div className="credential-label">Email / Username</div>
                          <div className="credential-value">{stock?.account_identifier as string}</div>
                        </div>
                        <button className="copy-btn" onClick={() => navigator.clipboard.writeText(stock?.account_identifier as string)}>Copy</button>
                      </div>
                      <div className="credential-field">
                        <div>
                          <div className="credential-label">Password</div>
                          <PasswordReveal encrypted={stock?.account_secret_encrypted as string} />
                        </div>
                      </div>
                      {Boolean(stock?.profile_info) && (
                        <div className="credential-field">
                          <div>
                            <div className="credential-label">Profil</div>
                            <div className="credential-value">{String(stock.profile_info)}</div>
                          </div>
                        </div>
                      )}
                      {Boolean(stock?.pin_info) && (
                        <div className="credential-field">
                          <div>
                            <div className="credential-label">PIN</div>
                            <div className="credential-value">{String(stock.pin_info)}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Support Ticket */}
            <SupportTicketForm buyerId={selectedOrder.buyer_id as number} orderId={selectedOrder.id as number} />
          </div>
        )}

        {/* Orders List */}
        {!selectedOrder && (
          <div className="status-card">
            {loading ? (
              <div className="loading-page"><div className="loading-spinner" /></div>
            ) : orders.length === 0 ? (
              <div className="empty-state">
                <div className="icon">🛍️</div>
                <h4>Belum ada pesanan</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Anda belum pernah melakukan pembelian.</p>
                <Link href="/" className="btn btn-primary" style={{ marginTop: '16px' }}>Beli Produk Sekarang</Link>
              </div>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Pesanan</th>
                      <th>Produk</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o: any) => (
                      <tr key={o.id}>
                        <td>
                          <div style={{ fontFamily: 'monospace', color: 'var(--brand-primary-light)', fontWeight: 600 }}>{o.order_number}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(o.created_at).toLocaleDateString('id-ID')}</div>
                        </td>
                        <td style={{ color: 'var(--text-primary)' }}>{o.product?.name || '-'}</td>
                        <td style={{ color: 'var(--brand-success)', fontWeight: 600 }}>{formatPrice(o.total_amount)}</td>
                        <td><span className={`badge ${getStatusBadge(o.order_status)}`}>{o.order_status}</span></td>
                        <td>
                          <button className="btn btn-secondary btn-sm" onClick={() => selectOrder(o)}>
                            Lihat Detail
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PasswordReveal({ encrypted }: { encrypted: string }) {
  const [revealed, setRevealed] = useState(false);
  const [password, setPassword] = useState('');
  const [loadingPw, setLoadingPw] = useState(false);

  async function reveal() {
    setLoadingPw(true);
    try {
      const res = await fetch('/api/buyer/decrypt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encrypted }),
      });
      const data = await res.json();
      setPassword(data.decrypted || '••••••••');
      setRevealed(true);
    } catch {
      setPassword('Error');
    }
    setLoadingPw(false);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div className="credential-value">{revealed ? password : '••••••••'}</div>
      {!revealed ? (
        <button className="copy-btn" onClick={reveal} disabled={loadingPw}>
          {loadingPw ? '...' : 'Tampilkan'}
        </button>
      ) : (
        <button className="copy-btn" onClick={() => navigator.clipboard.writeText(password)}>Copy</button>
      )}
    </div>
  );
}

function SupportTicketForm({ buyerId, orderId }: { buyerId: number; orderId: number }) {
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const now = new Date().toISOString();
    await supabase.from('support_tickets').insert({
      buyer_id: buyerId,
      order_id: orderId,
      subject,
      message,
      status: 'open',
      created_at: now,
      updated_at: now,
    });
    setSubmitted(true);
    setSaving(false);
  }

  return (
    <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-secondary)', paddingTop: '24px' }}>
      {submitted ? (
        <div style={{ textAlign: 'center', color: 'var(--brand-success)' }}>
          <p>✅ Ticket berhasil dikirim! Kami akan segera menghubungi kamu.</p>
        </div>
      ) : !showForm ? (
        <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setShowForm(true)}>
          🎫 Butuh Bantuan? Buat Ticket
        </button>
      ) : (
        <form onSubmit={handleSubmit}>
          <h4 style={{ marginBottom: '12px', fontSize: '0.9rem', fontWeight: 700 }}>Buat Support Ticket</h4>
          <div className="form-group">
            <label className="form-label">Subjek</label>
            <input className="form-input" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Masalah login akun..." required />
          </div>
          <div className="form-group">
            <label className="form-label">Pesan</label>
            <textarea className="form-textarea" value={message} onChange={e => setMessage(e.target.value)} placeholder="Jelaskan masalah kamu..." required />
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Batal</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="loading-spinner" /> : 'Kirim Ticket'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
