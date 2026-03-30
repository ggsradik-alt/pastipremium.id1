'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { adminUpdate, adminInsert, adminDelete } from '@/lib/adminApi';

interface Reseller {
  id: string;
  name: string;
  phone: string;
  ref_code: string;
  commission_per_sale: number;
  status: string;
  total_sales: number;
  total_commission: number;
  unpaid_commission: number;
  created_at: string;
}

interface Commission {
  id: string;
  reseller_id: string;
  order_id: number;
  commission_amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  order?: { order_number: string; total_amount: number; buyer: { name: string } };
}

export default function AdminResellersPage() {
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedReseller, setSelectedReseller] = useState<Reseller | null>(null);
  const [tab, setTab] = useState<'resellers' | 'commissions'>('resellers');
  const [copied, setCopied] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    phone: '',
    ref_code: '',
    commission_per_sale: 3000,
    status: 'active',
  });

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => { loadResellers(); }, []);

  async function loadResellers() {
    setLoading(true);
    const { data } = await supabase.from('resellers').select('*').order('created_at', { ascending: false });
    if (data) setResellers(data);
    setLoading(false);
  }

  async function loadCommissions(resellerId?: string) {
    let query = supabase
      .from('reseller_commissions')
      .select('*, order:orders(order_number, total_amount, buyer:buyers(name))')
      .order('created_at', { ascending: false });

    if (resellerId) {
      query = query.eq('reseller_id', resellerId);
    }

    const { data } = await query;
    if (data) setCommissions(data as unknown as Commission[]);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    let result;
    if (editingId) {
      result = await adminUpdate('resellers', {
        name: form.name,
        phone: form.phone,
        commission_per_sale: form.commission_per_sale,
        status: form.status,
        updated_at: new Date().toISOString(),
      }, { id: editingId });
    } else {
      result = await adminInsert('resellers', {
        name: form.name,
        phone: form.phone,
        ref_code: form.ref_code.toUpperCase().replace(/[^A-Z0-9]/g, ''),
        commission_per_sale: form.commission_per_sale,
        status: form.status,
      });
    }

    if (result.error) {
      alert('Gagal menyimpan: ' + result.error.message);
      return;
    }

    setForm({ name: '', phone: '', ref_code: '', commission_per_sale: 3000, status: 'active' });
    setEditingId(null);
    setShowForm(false);
    loadResellers();
  }

  function handleEdit(r: Reseller) {
    setEditingId(r.id);
    setForm({
      name: r.name,
      phone: r.phone || '',
      ref_code: r.ref_code,
      commission_per_sale: r.commission_per_sale,
      status: r.status,
    });
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus reseller ini? Semua data komisinya juga akan terhapus.')) return;
    const result = await adminDelete('resellers', { id });
    if (result.error) { alert('Gagal menghapus: ' + result.error.message); return; }
    loadResellers();
  }

  async function handlePayAll(reseller: Reseller) {
    if (!confirm(`Tandai semua komisi ${reseller.name} (${formatPrice(reseller.unpaid_commission)}) sebagai SUDAH DIBAYAR?`)) return;

    const r1 = await adminUpdate('reseller_commissions', { status: 'paid', paid_at: new Date().toISOString() }, { reseller_id: reseller.id });
    if (r1.error) { alert('Gagal update komisi: ' + r1.error.message); return; }

    const r2 = await adminUpdate('resellers', {
      unpaid_commission: 0,
      updated_at: new Date().toISOString(),
    }, { id: reseller.id });
    if (r2.error) { alert('Gagal update reseller: ' + r2.error.message); return; }

    loadResellers();
    if (selectedReseller?.id === reseller.id) loadCommissions(reseller.id);
    alert(`Komisi ${reseller.name} berhasil ditandai lunas!`);
  }

  function copyLink(refCode: string) {
    navigator.clipboard.writeText(`${siteUrl}/?ref=${refCode}`);
    setCopied(refCode);
    setTimeout(() => setCopied(null), 2000);
  }

  function formatPrice(n: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
  }

  function viewCommissions(r: Reseller) {
    setSelectedReseller(r);
    setTab('commissions');
    loadCommissions(r.id);
  }

  const totalUnpaid = resellers.reduce((sum, r) => sum + r.unpaid_commission, 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Reseller / Mitra</h1>
          <p style={{ color: 'var(--text-muted)' }}>Kelola karyawan freelance & komisi penjualan mereka.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ name: '', phone: '', ref_code: '', commission_per_sale: 3000, status: 'active' }); }}>
          {showForm ? 'Tutup Form' : '+ Tambah Reseller'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-label">TOTAL RESELLER</div>
          <div className="stat-value">{resellers.filter(r => r.status === 'active').length}</div>
          <div className="stat-icon">🤝</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">TOTAL PENJUALAN</div>
          <div className="stat-value">{resellers.reduce((s, r) => s + r.total_sales, 0)}</div>
          <div className="stat-icon">🛒</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">KOMISI BELUM DIBAYAR</div>
          <div className="stat-value" style={{ color: totalUnpaid > 0 ? '#eab308' : 'var(--brand-success)' }}>{formatPrice(totalUnpaid)}</div>
          <div className="stat-icon">💸</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button className={`btn btn-sm ${tab === 'resellers' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setTab('resellers'); setSelectedReseller(null); }}>
          Daftar Reseller ({resellers.length})
        </button>
        <button className={`btn btn-sm ${tab === 'commissions' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setTab('commissions'); loadCommissions(); setSelectedReseller(null); }}>
          Riwayat Komisi
        </button>
      </div>

      {/* ADD/EDIT FORM */}
      {showForm && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-secondary)', borderRadius: 'var(--radius-lg)', padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>{editingId ? 'Edit Reseller' : 'Tambah Reseller Baru'}</h2>
          <form onSubmit={handleSave}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nama Reseller</label>
                <input required className="form-input" placeholder="Contoh: Andi" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">No. WhatsApp</label>
                <input className="form-input" placeholder="08123456789" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Kode Referral (Unik)</label>
                <input
                  required={!editingId}
                  disabled={!!editingId}
                  className="form-input"
                  placeholder="Contoh: ANDI"
                  value={form.ref_code}
                  onChange={e => setForm({ ...form, ref_code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                  style={editingId ? { opacity: 0.5 } : {}}
                />
                {!editingId && <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>Huruf besar & angka saja. Ini akan jadi link unik reseller.</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Komisi per Transaksi (Rp)</label>
                <input required type="number" className="form-input" min={0} value={form.commission_per_sale} onChange={e => setForm({ ...form, commission_per_sale: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button type="submit" className="btn btn-primary">{editingId ? 'Simpan Perubahan' : 'Tambahkan'}</button>
              <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Batal</button>
            </div>
          </form>
        </div>
      )}

      {/* RESELLERS TAB */}
      {tab === 'resellers' && (
        loading ? <div className="loading-page"><div className="loading-spinner" /></div> : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Kode Ref</th>
                  <th>Komisi/Sale</th>
                  <th>Penjualan</th>
                  <th>Belum Dibayar</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {resellers.map(r => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.phone || '-'}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <code style={{ background: 'var(--accent-soft)', color: 'var(--accent)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>{r.ref_code}</code>
                        <button className="btn btn-secondary btn-sm" style={{ padding: '3px 8px', fontSize: '0.7rem' }} onClick={() => copyLink(r.ref_code)}>
                          {copied === r.ref_code ? '✅' : '📋'}
                        </button>
                      </div>
                    </td>
                    <td style={{ color: 'var(--accent)' }}>{formatPrice(r.commission_per_sale)}</td>
                    <td style={{ fontWeight: 700 }}>{r.total_sales}</td>
                    <td style={{ color: r.unpaid_commission > 0 ? '#eab308' : 'var(--text-muted)', fontWeight: 700 }}>
                      {formatPrice(r.unpaid_commission)}
                    </td>
                    <td>
                      <span className={`badge ${r.status === 'active' ? 'badge-success' : 'badge-danger'}`}>{r.status}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => viewCommissions(r)}>📊 Detail</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(r)}>Edit</button>
                        {r.unpaid_commission > 0 && (
                          <button className="btn btn-sm" style={{ background: '#22c55e', color: '#fff', border: 'none', fontWeight: 600 }} onClick={() => handlePayAll(r)}>
                            💰 Bayar
                          </button>
                        )}
                        <button className="btn btn-secondary btn-sm" style={{ color: '#ef4444' }} onClick={() => handleDelete(r.id)}>Hapus</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {resellers.length === 0 && (
                  <tr><td colSpan={7} className="empty-state"><div className="icon">🤝</div><h3>Belum ada reseller</h3><p>Klik &quot;+ Tambah Reseller&quot; untuk memulai.</p></td></tr>
                )}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* COMMISSIONS TAB */}
      {tab === 'commissions' && (
        <div>
          {selectedReseller && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-secondary)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Riwayat Komisi: {selectedReseller.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Kode: {selectedReseller.ref_code} — Komisi/sale: {formatPrice(selectedReseller.commission_per_sale)}</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => { setSelectedReseller(null); loadCommissions(); }}>Lihat Semua</button>
            </div>
          )}
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Order</th>
                  <th>Buyer</th>
                  <th>Harga Produk</th>
                  <th>Komisi</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontSize: '0.8rem' }}>{new Date(c.created_at).toLocaleString('id-ID')}</td>
                    <td><code style={{ color: 'var(--accent)' }}>{c.order?.order_number || '-'}</code></td>
                    <td>{(c.order?.buyer as any)?.name || '-'}</td>
                    <td>{c.order?.total_amount ? formatPrice(c.order.total_amount) : '-'}</td>
                    <td style={{ fontWeight: 700, color: 'var(--brand-success)' }}>{formatPrice(c.commission_amount)}</td>
                    <td>
                      <span className={`badge ${c.status === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                        {c.status === 'paid' ? '✅ Dibayar' : '⏳ Belum'}
                      </span>
                    </td>
                  </tr>
                ))}
                {commissions.length === 0 && (
                  <tr><td colSpan={6} className="empty-state"><div className="icon">📊</div><h3>Belum ada riwayat komisi</h3></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
