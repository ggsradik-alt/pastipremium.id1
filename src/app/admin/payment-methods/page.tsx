'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { adminUpdate, adminInsert, adminDelete } from '@/lib/adminApi';

interface PaymentMethod {
  id: string;
  provider: string;
  account_name: string;
  account_number: string;
  description: string;
  is_active: boolean;
}

export default function AdminPaymentMethodsPage() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [form, setForm] = useState({
    provider: '',
    account_name: '',
    account_number: '',
    description: '',
    is_active: true
  });

  useEffect(() => {
    loadMethods();
  }, []);

  async function loadMethods() {
    setLoading(true);
    const { data } = await supabase.from('payment_methods').select('*').order('created_at', { ascending: true });
    if (data) setMethods(data);
    setLoading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) {
      await adminUpdate('payment_methods', form, { id: editingId });
    } else {
      await adminInsert('payment_methods', form);
    }
    setForm({ provider: '', account_name: '', account_number: '', description: '', is_active: true });
    setEditingId(null);
    loadMethods();
  }

  function handleEdit(m: PaymentMethod) {
    setEditingId(m.id);
    setForm({
      provider: m.provider,
      account_name: m.account_name,
      account_number: m.account_number,
      description: m.description || '',
      is_active: m.is_active
    });
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus metode pembayaran ini?')) return;
    await adminDelete('payment_methods', { id });
    loadMethods();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Metode Pembayaran</h1>
          <p style={{ color: 'var(--text-muted)' }}>Atur rekening bank dan *e-wallet* untuk pelanggan transfer.</p>
        </div>
        {editingId && (
          <button className="btn btn-secondary" onClick={() => {
            setEditingId(null);
            setForm({ provider: '', account_name: '', account_number: '', description: '', is_active: true });
          }}>
            Batal Edit
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px' }}>
        {/* TABEL METODE PEMBAYARAN */}
        <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-secondary)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>Daftar Rekening</h2>
          {loading ? (
            <div className="loading-spinner" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {methods.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>Belum ada metode pembayaran yang ditambahkan.</p>
              ) : (
                methods.map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', border: '1px solid var(--border-secondary)', borderRadius: 'var(--radius-md)' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>{m.provider}</strong>
                        {!m.is_active && <span style={{ fontSize: '0.7rem', background: '#ef4444', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>Tidak Aktif</span>}
                      </div>
                      <div style={{ fontFamily: 'monospace', fontSize: '1.1rem', letterSpacing: '1px' }}>{m.account_number}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>a.n. {m.account_name} &nbsp; {m.description && `(${m.description})`}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(m)}>Edit</button>
                      <button className="btn btn-secondary btn-sm" style={{ color: '#ef4444', borderColor: '#ef4444' }} onClick={() => handleDelete(m.id)}>Hapus</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* BFORM TAMBAH/EDIT */}
        <div>
          <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-secondary)' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>{editingId ? 'Edit Rekening' : 'Tambah Rekening Baru'}</h2>
            
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label>Nama Bank / E-Wallet</label>
                <input required type="text" className="form-control" placeholder="Contoh: BCA / DANA" value={form.provider} onChange={e => setForm({...form, provider: e.target.value})} />
              </div>
              
              <div className="form-group">
                <label>Nomor Rekening</label>
                <input required type="text" className="form-control" placeholder="Contoh: 0922883441" value={form.account_number} onChange={e => setForm({...form, account_number: e.target.value})} />
              </div>

              <div className="form-group">
                <label>Atas Nama (A.N)</label>
                <input required type="text" className="form-control" placeholder="Nama Pemilik" value={form.account_name} onChange={e => setForm({...form, account_name: e.target.value})} />
              </div>

              <div className="form-group">
                <label>Keterangan (Opsional)</label>
                <input type="text" className="form-control" placeholder="Contoh: Transfer Bank Bebas Biaya" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})} />
                <label htmlFor="is_active" style={{ fontSize: '0.9rem', cursor: 'pointer' }}>Tampilkan ke Pembeli</label>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                {editingId ? 'Simpan Perubahan' : 'Tambahkan'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
