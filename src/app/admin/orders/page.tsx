'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Order } from '@/lib/types';

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [proofModal, setProofModal] = useState<Order | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => { loadOrders(); }, []);

  async function loadOrders() {
    const { data } = await supabase
      .from('orders')
      .select('*, buyer:buyers(*), product:products(*)')
      .order('created_at', { ascending: false });
    setOrders(data || []);
    setLoading(false);
  }

  async function handleManualAssign(order: Order) {
    setAssigning(true);
    const { data, error } = await supabase.rpc('assign_account_for_order', { p_order_id: order.id });
    
    if (error) {
      alert('Error: ' + error.message);
      setAssigning(false);
      return;
    }
    if (data && !data.success) {
      alert('Gagal: ' + data.error);
      setAssigning(false);
      return;
    }

    await loadOrders();

    const buyer = order.buyer as any;
    if (buyer?.phone) {
      await sendWA(order);
    } else {
      alert('Berhasil di-assign, tapi buyer tidak punya nomor WhatsApp untuk dikirim pesan.');
    }

    setAssigning(false);
    setSelectedOrder(null);
  }

  async function sendWA(order: Order) {
    const buyer = order.buyer as any;
    const product = order.product as any;

    try {
      const { data: assignment, error: assignErr } = await supabase
        .from('account_assignments')
        .select('*, stock_account:stock_accounts(*)')
        .eq('order_id', order.id)
        .eq('status', 'active')
        .single();

      if (assignErr || !assignment) {
        alert('Berhasil di-assign, namun gagal membuka WhatsApp. Gunakan tombol "Kirim WA" secara manual.');
        return;
      }

      const res = await fetch('/api/buyer/decrypt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encrypted: assignment.stock_account.account_secret_encrypted }),
      });
      const decData = await res.json();
      const password = decData.decrypted || 'Gagal-Dekripsi';
      const sa = assignment.stock_account;

      const text = `Halo *${buyer.name}*,\nPesanan Anda telah dikonfirmasi! ✅\n\nBerikut detail akun untuk produk *${product.name}*:\n\n` +
        `👤 *Email/User:* ${sa.account_identifier}\n` +
        `🔑 *Password:* ${password}\n` +
        (sa.profile_info ? `👤 *Profil:* ${sa.profile_info}\n` : '') +
        (sa.pin_info ? `🔐 *PIN:* ${sa.pin_info}\n` : '') +
        `\n⏳ *Masa Aktif:* ${product.duration_days} hari\n` +
        `\n_Catatan:_\nMohon simpan akun ini baik-baik. Jangan ubah password / informasi akun jika ini akun sharing agar tidak mengganggu pengguna lain.\n\nTerima kasih telah berbelanja di *Pasti Premium.id*! 🙏`;

      let phone = buyer.phone.replace(/[^0-9]/g, '');
      if (phone.startsWith('0')) phone = '62' + phone.substring(1);

      const waLink = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
      window.open(waLink, '_blank');
    } catch {
      alert('Berhasil di-assign, namun gagal membuka WhatsApp. Gunakan tombol "Kirim WA" secara manual.');
    }
  }

  async function handleApprovePayment(order: Order) {
    if (!confirm(`Konfirmasi pembayaran untuk order ${order.order_number}?\n\nIni akan:\n1. Mengubah status menjadi PAID\n2. Otomatis assign akun ke buyer\n3. Auto-delivery langsung aktif`)) return;

    try {
      const res = await fetch('/api/payments/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_number: order.order_number,
          gateway_name: 'manual_transfer',
          gateway_reference: 'MANUAL-' + Date.now(),
          amount: order.total_amount,
          status: 'success',
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ Pembayaran dikonfirmasi! Auto-delivery berhasil.');
        setProofModal(null);
        loadOrders();
      } else {
        alert('Error: ' + (data.error || 'Unknown'));
      }
    } catch {
      alert('Terjadi kesalahan jaringan');
    }
  }

  async function handleRejectPayment(order: Order) {
    const reason = prompt('Alasan penolakan pembayaran:');
    if (!reason) return;

    await supabase
      .from('orders')
      .update({
        payment_status: 'pending_payment',
        payment_proof_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    alert(`Bukti pembayaran ditolak. Buyer dapat mengupload ulang.\nAlasan: ${reason}`);
    setProofModal(null);
    loadOrders();
  }

  function formatPrice(price: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(price);
  }

  function getStatusBadge(status: string) {
    const map: Record<string, string> = {
      pending: 'badge-neutral', paid: 'badge-info', assigned: 'badge-primary',
      delivered: 'badge-success', completed: 'badge-success', cancelled: 'badge-danger',
      refunded: 'badge-warning', pending_payment: 'badge-neutral', failed: 'badge-danger',
      waiting_confirmation: 'badge-warning',
    };
    return map[status] || 'badge-neutral';
  }

  const filteredOrders = filterStatus === 'all' 
    ? orders 
    : orders.filter(o => o.payment_status === filterStatus || o.order_status === filterStatus);

  const waitingCount = orders.filter(o => o.payment_status === 'waiting_confirmation').length;

  return (
    <div className="admin-content">
      <div className="admin-topbar">
        <h2>Pesanan</h2>
        {waitingCount > 0 && (
          <div style={{
            background: 'rgba(234,179,8,0.15)',
            border: '1px solid rgba(234,179,8,0.3)',
            borderRadius: 'var(--radius-full)',
            padding: '6px 16px',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: '#eab308',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            🔔 {waitingCount} bukti pembayaran menunggu verifikasi
          </div>
        )}
      </div>
      <div style={{ padding: '32px' }}>
        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: 'Semua', count: orders.length },
            { key: 'waiting_confirmation', label: '⏳ Perlu Verifikasi', count: waitingCount },
            { key: 'pending_payment', label: 'Belum Bayar', count: orders.filter(o => o.payment_status === 'pending_payment').length },
            { key: 'paid', label: 'Sudah Bayar', count: orders.filter(o => o.payment_status === 'paid').length },
            { key: 'delivered', label: 'Terkirim', count: orders.filter(o => o.order_status === 'delivered').length },
          ].map(f => (
            <button
              key={f.key}
              className={`btn btn-sm ${filterStatus === f.key ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterStatus(f.key)}
              style={{ fontSize: '0.8rem' }}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading-page"><div className="loading-spinner" /></div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Buyer</th>
                  <th>Produk</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Tanggal</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(o => (
                  <tr key={o.id} style={{
                    background: o.payment_status === 'waiting_confirmation' ? 'rgba(234,179,8,0.04)' : undefined,
                  }}>
                    <td style={{ fontFamily: 'monospace', color: 'var(--brand-primary-light)' }}>{o.order_number}</td>
                    <td style={{ color: 'var(--text-primary)' }}>{(o.buyer as unknown as { name: string })?.name || '-'}</td>
                    <td>{(o.product as unknown as { name: string })?.name || '-'}</td>
                    <td style={{ color: 'var(--brand-success)' }}>{formatPrice(o.total_amount)}</td>
                    <td><span className={`badge ${getStatusBadge(o.payment_status)}`}>{o.payment_status === 'waiting_confirmation' ? '⏳ Menunggu' : o.payment_status}</span></td>
                    <td><span className={`badge ${getStatusBadge(o.order_status)}`}>{o.order_status}</span></td>
                    <td style={{ fontSize: '0.8rem' }}>{new Date(o.created_at).toLocaleString('id-ID')}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setSelectedOrder(o)}>Detail</button>
                        
                        {/* Show "Cek Bukti" for waiting_confirmation */}
                        {o.payment_status === 'waiting_confirmation' && (
                          <button
                            className="btn btn-sm"
                            style={{ backgroundColor: '#eab308', color: '#000', border: 'none', fontWeight: 700 }}
                            onClick={() => setProofModal(o)}
                          >
                            🔍 Cek Bukti
                          </button>
                        )}

                        {o.payment_status === 'pending_payment' && (
                          <button className="btn btn-success btn-sm" onClick={() => handleApprovePayment(o)}>✅ Konfirmasi</button>
                        )}
                        {o.payment_status === 'paid' && o.order_status === 'paid' && (
                          <button className="btn btn-sm" style={{ backgroundColor: '#25D366', color: '#fff', border: 'none', fontWeight: 600 }} onClick={() => handleManualAssign(o)} disabled={assigning}>
                            {assigning ? <span className="loading-spinner" style={{ width: '14px', height: '14px' }} /> : '📞 Assign & Kirim WA'}
                          </button>
                        )}
                        {(o.order_status === 'assigned' || o.order_status === 'delivered') && (
                          <button className="btn btn-sm" style={{ backgroundColor: '#25D366', color: '#fff', border: 'none', fontWeight: 600 }} onClick={() => sendWA(o)}>
                            📞 Kirim Ulang WA
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredOrders.length === 0 && (
                  <tr><td colSpan={8} className="empty-state"><div className="icon">🛒</div><h3>Tidak ada pesanan</h3></td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Detail Pesanan {selectedOrder.order_number}</h3>
            <div style={{ display: 'grid', gap: '12px' }}>
              <div><span className="form-label">Buyer:</span> <span style={{ color: 'var(--text-primary)' }}>{(selectedOrder.buyer as unknown as { name: string })?.name}</span></div>
              <div><span className="form-label">Phone:</span> <span style={{ color: 'var(--text-primary)' }}>{(selectedOrder.buyer as unknown as { phone: string })?.phone}</span></div>
              <div><span className="form-label">Produk:</span> <span style={{ color: 'var(--text-primary)' }}>{(selectedOrder.product as unknown as { name: string })?.name}</span></div>
              <div><span className="form-label">Total:</span> <span style={{ color: 'var(--brand-success)', fontWeight: 700 }}>{formatPrice(selectedOrder.total_amount)}</span></div>
              <div><span className="form-label">Payment:</span> <span className={`badge ${getStatusBadge(selectedOrder.payment_status)}`}>{selectedOrder.payment_status}</span></div>
              <div><span className="form-label">Order Status:</span> <span className={`badge ${getStatusBadge(selectedOrder.order_status)}`}>{selectedOrder.order_status}</span></div>
              {selectedOrder.paid_at && <div><span className="form-label">Paid At:</span> {new Date(selectedOrder.paid_at).toLocaleString('id-ID')}</div>}
              {selectedOrder.delivered_at && <div><span className="form-label">Delivered At:</span> {new Date(selectedOrder.delivered_at).toLocaleString('id-ID')}</div>}
              
              {/* Show proof in detail modal if exists */}
              {(selectedOrder as any).payment_proof_url && (
                <div>
                  <span className="form-label">Bukti Transfer:</span>
                  <img
                    src={(selectedOrder as any).payment_proof_url}
                    alt="Bukti Transfer"
                    style={{ width: '100%', maxHeight: '300px', objectFit: 'contain', borderRadius: 'var(--radius-md)', marginTop: '8px', border: '1px solid var(--border-secondary)' }}
                  />
                </div>
              )}
            </div>
            <div className="modal-actions"><button className="btn btn-secondary" onClick={() => setSelectedOrder(null)}>Tutup</button></div>
          </div>
        </div>
      )}

      {/* Payment Proof Verification Modal */}
      {proofModal && (
        <div className="modal-overlay" onClick={() => setProofModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              🔍 Verifikasi Pembayaran
            </h3>
            
            {/* Order Info */}
            <div style={{
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              padding: '14px',
              marginBottom: '16px',
              display: 'grid',
              gap: '8px',
              fontSize: '0.85rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Order</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontFamily: 'monospace' }}>{proofModal.order_number}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Buyer</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{(proofModal.buyer as unknown as { name: string })?.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Nominal</span>
                <span style={{ color: 'var(--brand-success)', fontWeight: 700, fontSize: '1.1rem' }}>{formatPrice(proofModal.total_amount)}</span>
              </div>
            </div>
            
            {/* Proof Image */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                📸 Bukti Transfer
              </div>
              {(proofModal as any).payment_proof_url ? (
                <img
                  src={(proofModal as any).payment_proof_url}
                  alt="Bukti Transfer"
                  style={{
                    width: '100%',
                    maxHeight: '400px',
                    objectFit: 'contain',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-secondary)',
                    background: '#000',
                    cursor: 'pointer',
                  }}
                  onClick={() => window.open((proofModal as any).payment_proof_url, '_blank')}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No proof uploaded
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: 'center', background: 'var(--brand-success)', border: 'none' }}
                onClick={() => handleApprovePayment(proofModal)}
              >
                ✅ Approve & Auto-Deliver
              </button>
              <button
                className="btn"
                style={{ flex: 1, justifyContent: 'center', background: '#ef4444', color: '#fff', border: 'none' }}
                onClick={() => handleRejectPayment(proofModal)}
              >
                ❌ Tolak
              </button>
            </div>
            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setProofModal(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)' }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
