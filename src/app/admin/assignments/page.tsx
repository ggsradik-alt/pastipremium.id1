'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { adminRpc } from '@/lib/adminApi';

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAssignments(); }, []);

  async function loadAssignments() {
    const { data } = await supabase
      .from('account_assignments')
      .select('*, order:orders(order_number), buyer:buyers(name), stock_account:stock_accounts(account_identifier)')
      .order('created_at', { ascending: false });
    setAssignments(data || []);
    setLoading(false);
  }

  async function handleReplace(assignmentId: number) {
    const reason = prompt('Alasan penggantian akun:');
    if (!reason) return;
    
    const admin = JSON.parse(localStorage.getItem('admin_session') || '{}');
    const result = await adminRpc('replace_account_assignment', {
      p_old_assignment_id: assignmentId,
      p_reason: reason,
      p_admin_id: admin.id,
    });

    if (result.error) { alert('Error: ' + result.error); return; }
    if (result.data && !result.data.success) { alert('Gagal: ' + result.data.error); return; }
    alert('Akun berhasil diganti!');
    loadAssignments();
  }

  function getStatusBadge(status: string) {
    const map: Record<string, string> = {
      active: 'badge-success', expired: 'badge-neutral', replaced: 'badge-warning', cancelled: 'badge-danger',
    };
    return map[status] || 'badge-neutral';
  }

  return (
    <div className="admin-content">
      <div className="admin-topbar"><h2>Account Assignments</h2></div>
      <div style={{ padding: '32px' }}>
        {loading ? (
          <div className="loading-page"><div className="loading-spinner" /></div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Order</th>
                  <th>Buyer</th>
                  <th>Akun</th>
                  <th>Tipe</th>
                  <th>Mulai</th>
                  <th>Expired</th>
                  <th>Status</th>
                  <th>Delivered</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a: Record<string, unknown>) => (
                  <tr key={a.id as number}>
                    <td style={{ fontFamily: 'monospace' }}>#{a.id as number}</td>
                    <td style={{ fontFamily: 'monospace', color: 'var(--brand-primary-light)' }}>{(a.order as Record<string, string>)?.order_number || '-'}</td>
                    <td style={{ color: 'var(--text-primary)' }}>{(a.buyer as Record<string, string>)?.name || '-'}</td>
                    <td style={{ fontFamily: 'monospace', color: 'var(--brand-accent)' }}>{(a.stock_account as Record<string, string>)?.account_identifier || '-'}</td>
                    <td><span className={`badge ${(a.assignment_type as string) === 'auto' ? 'badge-info' : (a.assignment_type as string) === 'manual' ? 'badge-warning' : 'badge-primary'}`}>{a.assignment_type as string}</span></td>
                    <td style={{ fontSize: '0.8rem' }}>{new Date(a.start_at as string).toLocaleDateString('id-ID')}</td>
                    <td style={{ fontSize: '0.8rem' }}>{new Date(a.expired_at as string).toLocaleDateString('id-ID')}</td>
                    <td><span className={`badge ${getStatusBadge(a.status as string)}`}>{a.status as string}</span></td>
                    <td style={{ fontSize: '0.8rem' }}>{(a.delivered_at as string) ? new Date(a.delivered_at as string).toLocaleDateString('id-ID') : '—'}</td>
                    <td>
                      {(a.status as string) === 'active' && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleReplace(a.id as number)}>Replace</button>
                      )}
                    </td>
                  </tr>
                ))}
                {assignments.length === 0 && (
                  <tr><td colSpan={10} className="empty-state"><div className="icon">🔗</div><h3>Belum ada assignment</h3></td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
