'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { StockAccount, Product } from '@/lib/types';

export default function StockAccountsPage() {
  const [accounts, setAccounts] = useState<StockAccount[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<StockAccount | null>(null);
  const [isCopy, setIsCopy] = useState(false);
  const [showBuyers, setShowBuyers] = useState<number | null>(null);
  const [buyers, setBuyers] = useState<Array<{ id: number; buyer_name: string; status: string; start_at: string; expired_at: string }>>([]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [{ data: accs }, { data: prods }] = await Promise.all([
      supabase.from('stock_accounts').select('*, product:products(*)').order('created_at', { ascending: false }),
      supabase.from('products').select('*').eq('status', 'active').order('name'),
    ]);
    setAccounts(accs || []);
    setProducts(prods || []);
    setLoading(false);
  }

  async function loadBuyers(accountId: number) {
    const { data } = await supabase
      .from('account_assignments')
      .select('id, status, start_at, expired_at, buyer:buyers(name)')
      .eq('stock_account_id', accountId)
      .eq('status', 'active');
    setBuyers((data || []).map((d: Record<string, unknown>) => ({
      id: d.id as number,
      buyer_name: (d.buyer as Record<string, unknown>)?.name as string || 'Unknown',
      status: d.status as string,
      start_at: d.start_at as string,
      expired_at: d.expired_at as string,
    })));
    setShowBuyers(accountId);
  }

  function getSlotClass(used: number, max: number) {
    const pct = (used / max) * 100;
    if (pct >= 100) return 'full';
    if (pct >= 50) return 'medium';
    return 'low';
  }

  return (
    <div className="admin-content">
      <div className="admin-topbar">
        <h2>Stok Akun</h2>
        <button className="btn btn-primary" onClick={() => { setEditItem(null); setIsCopy(false); setShowForm(true); }}>+ Tambah Stok</button>
      </div>
      <div style={{ padding: '32px' }}>
        {loading ? (
          <div className="loading-page"><div className="loading-spinner" /></div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Produk</th>
                  <th>Identifier</th>
                  <th>Tipe</th>
                  <th>Slot Usage</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontFamily: 'monospace' }}>#{a.id}</td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{(a.product as unknown as Product)?.name || '-'}</td>
                    <td style={{ fontFamily: 'monospace', color: 'var(--brand-accent)' }}>{a.account_identifier}</td>
                    <td>
                      <span className={`badge ${a.account_type === 'sharing' ? 'badge-info' : 'badge-primary'}`}>
                        {a.account_type}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '120px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {a.current_used_slot}/{a.max_slot}
                        </span>
                        <div className="slot-bar" style={{ flex: 1 }}>
                          <div
                            className={`slot-bar-fill ${getSlotClass(a.current_used_slot, a.max_slot)}`}
                            style={{ width: `${(a.current_used_slot / a.max_slot) * 100}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${
                        a.status === 'active' ? 'badge-success' :
                        a.status === 'full' ? 'badge-warning' :
                        a.status === 'suspended' || a.status === 'broken' ? 'badge-danger' :
                        'badge-neutral'
                      }`}>
                        {a.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => { setEditItem(a); setIsCopy(false); setShowForm(true); }}>Edit</button>
                        <button className="btn btn-info btn-sm" onClick={() => { setEditItem(a); setIsCopy(true); setShowForm(true); }}>📋 Duplikat</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => loadBuyers(a.id)}>Buyers</button>
                        <select
                          className="form-select"
                          value={a.status}
                          style={{ padding: '4px 8px', fontSize: '0.75rem', width: 'auto' }}
                          onChange={async (e) => {
                            await supabase.from('stock_accounts').update({ status: e.target.value, updated_at: new Date().toISOString() }).eq('id', a.id);
                            loadData();
                          }}
                        >
                          <option value="active">Active</option>
                          <option value="full">Full</option>
                          <option value="inactive">Inactive</option>
                          <option value="suspended">Suspended</option>
                          <option value="broken">Broken</option>
                          <option value="expired">Expired</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
                {accounts.length === 0 && (
                  <tr><td colSpan={7} className="empty-state"><div className="icon">🔑</div><h3>Belum ada stok akun</h3></td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <StockAccountForm
          account={editItem}
          isCopy={isCopy}
          products={products}
          onClose={() => setShowForm(false)}
          onSave={() => { setShowForm(false); loadData(); }}
        />
      )}

      {showBuyers !== null && (
        <div className="modal-overlay" onClick={() => setShowBuyers(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Buyers Menggunakan Akun #{showBuyers}</h3>
            {buyers.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>Tidak ada buyer aktif</p>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead><tr><th>Buyer</th><th>Status</th><th>Mulai</th><th>Expired</th></tr></thead>
                  <tbody>
                    {buyers.map(b => (
                      <tr key={b.id}>
                        <td style={{ color: 'var(--text-primary)' }}>{b.buyer_name}</td>
                        <td><span className="badge badge-success">{b.status}</span></td>
                        <td>{new Date(b.start_at).toLocaleDateString('id-ID')}</td>
                        <td>{new Date(b.expired_at).toLocaleDateString('id-ID')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="modal-actions"><button className="btn btn-secondary" onClick={() => setShowBuyers(null)}>Tutup</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function StockAccountForm({ account, isCopy, products, onClose, onSave }: {
  account: StockAccount | null;
  isCopy?: boolean;
  products: Product[];
  onClose: () => void;
  onSave: () => void;
}) {
  const isEdit = account && !isCopy;
  const [form, setForm] = useState({
    product_id: account?.product_id?.toString() || '',
    account_identifier: isCopy ? '' : (account?.account_identifier || ''),
    account_secret: '',
    profile_info: account?.profile_info || '',
    pin_info: account?.pin_info || '',
    notes_internal: account?.notes_internal || '',
    purchase_cost: account?.purchase_cost?.toString() || '',
    current_used_slot: isEdit ? (account?.current_used_slot?.toString() || '0') : '0',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedProduct = products.find(p => p.id.toString() === form.product_id);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/admin/stock-accounts', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: isEdit ? account?.id : undefined,
          product_id: parseInt(form.product_id),
          account_identifier: form.account_identifier,
          account_secret: form.account_secret || undefined,
          profile_info: form.profile_info || null,
          pin_info: form.pin_info || null,
          notes_internal: form.notes_internal || null,
          purchase_cost: form.purchase_cost ? parseFloat(form.purchase_cost) : null,
          account_type: selectedProduct?.account_type || 'sharing',
          max_slot: selectedProduct?.default_max_slot || 4,
          current_used_slot: isEdit ? parseInt(form.current_used_slot) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setSaving(false); return; }
      onSave();
    } catch {
      setError('Terjadi kesalahan');
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">{isCopy ? '📋 Duplikat Stok Akun' : (account ? 'Edit Stok Akun' : 'Tambah Stok Akun')}</h3>
        {isCopy && (
          <div style={{ padding: '12px 16px', background: 'rgba(37,211,102,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(37,211,102,0.2)', marginBottom: '16px' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--brand-success)', margin: 0 }}>📋 Data produk, profil, PIN & catatan sudah tercopy. Isi email/username & password baru lalu simpan.</p>
          </div>
        )}
        {error && <div className="login-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Produk</label>
            <select className="form-select" value={form.product_id} onChange={e => setForm({...form, product_id: e.target.value})} required>
              <option value="">Pilih produk...</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.account_type})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Email / Username Akun</label>
            <input className="form-input" value={form.account_identifier} onChange={e => setForm({...form, account_identifier: e.target.value})} placeholder="user@email.com" required />
          </div>
          <div className="form-group">
            <label className="form-label">Password Akun {isEdit && '(kosongkan jika tidak diubah)'}</label>
            <input className="form-input" value={form.account_secret} onChange={e => setForm({...form, account_secret: e.target.value})} placeholder="••••••••" required={!isEdit} />
          </div>
          <div style={{ padding: '12px 16px', background: 'rgba(108,92,231,0.06)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)', marginBottom: '16px' }}>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>💡 Kolom profil & PIN bersifat <strong style={{ color: 'var(--text-secondary)' }}>opsional</strong>. Akun seperti Gemini, ChatGPT, Grok tidak membutuhkan kolom ini.</p>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nama Profil <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>(opsional)</span></label>
              <input className="form-input" value={form.profile_info} onChange={e => setForm({...form, profile_info: e.target.value})} placeholder="Contoh: Profile 1" />
            </div>
            <div className="form-group">
              <label className="form-label">PIN <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>(opsional)</span></label>
              <input className="form-input" value={form.pin_info} onChange={e => setForm({...form, pin_info: e.target.value})} placeholder="Contoh: 1234" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Harga Beli</label>
              <input type="number" className="form-input" value={form.purchase_cost} onChange={e => setForm({...form, purchase_cost: e.target.value})} placeholder="25000" />
            </div>
            {isEdit && (
              <div className="form-group">
                <label className="form-label">Slot Terpakai (Usage)</label>
                <input type="number" className="form-input" value={form.current_used_slot} onChange={e => setForm({...form, current_used_slot: e.target.value})} min="0" />
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Catatan Internal</label>
            <textarea className="form-textarea" value={form.notes_internal} onChange={e => setForm({...form, notes_internal: e.target.value})} placeholder="Catatan..." />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Batal</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="loading-spinner" /> : (isEdit ? 'Simpan' : (isCopy ? '📋 Simpan Duplikat' : 'Tambah'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
