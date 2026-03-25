'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function BuyersPage() {
  const [buyers, setBuyers] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadBuyers(); }, []);

  async function loadBuyers() {
    const { data } = await supabase.from('buyers').select('*').order('created_at', { ascending: false });
    setBuyers(data || []);
    setLoading(false);
  }

  return (
    <div className="admin-content">
      <div className="admin-topbar"><h2>Buyers</h2></div>
      <div style={{ padding: '32px' }}>
        {loading ? (
          <div className="loading-page"><div className="loading-spinner" /></div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>ID</th><th>Nama</th><th>Email</th><th>Phone</th><th>Status</th><th>Terdaftar</th><th>Aksi</th></tr>
              </thead>
              <tbody>
                {buyers.map(b => (
                  <tr key={b.id as number}>
                    <td style={{ fontFamily: 'monospace' }}>#{b.id as number}</td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{b.name as string}</td>
                    <td>{(b.email as string) || '—'}</td>
                    <td>{(b.phone as string) || '—'}</td>
                    <td><span className={`badge ${(b.status as string) === 'active' ? 'badge-success' : 'badge-danger'}`}>{b.status as string}</span></td>
                    <td style={{ fontSize: '0.8rem' }}>{new Date(b.created_at as string).toLocaleDateString('id-ID')}</td>
                    <td>
                      <button
                        className={`btn btn-sm ${(b.status as string) === 'active' ? 'btn-danger' : 'btn-success'}`}
                        onClick={async () => {
                          await supabase.from('buyers').update({ status: (b.status as string) === 'active' ? 'blocked' : 'active', updated_at: new Date().toISOString() }).eq('id', b.id);
                          loadBuyers();
                        }}
                      >
                        {(b.status as string) === 'active' ? 'Block' : 'Aktifkan'}
                      </button>
                    </td>
                  </tr>
                ))}
                {buyers.length === 0 && (
                  <tr><td colSpan={7} className="empty-state"><div className="icon">👥</div><h3>Belum ada buyer</h3></td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
