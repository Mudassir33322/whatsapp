import { useState, useEffect, useCallback } from 'react';
import { ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import { useAdminAuth } from './AdminAuthContext';
import { Pagination } from '../components/Pagination';
import { EmptyState } from '../components/EmptyState';

interface AuditLog {
  id: number;
  admin_email: string;
  action: string;
  entity_type: string;
  entity_id: string | number | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

const LIMIT = 50;

export function AdminAudit() {
  const { adminFetch } = useAdminAuth();
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const offset = (page - 1) * LIMIT;
      const res = await adminFetch(`/api/admin/audit-logs?limit=${LIMIT}&offset=${offset}`, { signal });
      if (!res.ok) throw new Error('Failed to load audit logs');
      const json = await res.json();
      setRows(Array.isArray(json.data) ? json.data : []);
      setTotal(typeof json.total === 'number' ? json.total : Array.isArray(json.data) ? json.data.length : 0);
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-indigo-400" /> Audit Log
          </h1>
          <p className="text-sm text-slate-400 mt-1">Track administrative actions across the platform</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-rose-500/10 text-rose-400 rounded-xl text-sm">{error}</div>
      )}

      {loading ? (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden animate-pulse">
          <div className="p-4 border-b border-slate-700"><div className="h-4 bg-slate-700 rounded w-full" /></div>
          <div className="space-y-1 p-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <div className="h-4 bg-slate-700 rounded w-40" />
                <div className="h-4 bg-slate-700 rounded w-28" />
                <div className="h-4 bg-slate-700 rounded w-24" />
                <div className="h-4 bg-slate-700 rounded w-32 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-700/50 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Time</th>
                  <th className="px-5 py-3">Admin</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Entity</th>
                  <th className="px-5 py-3">Details</th>
                  <th className="px-5 py-3">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {rows.length === 0 ? (
                  <tr><td colSpan={6}><div className="px-6 py-8"><EmptyState icon={ClipboardList} title="No audit entries" description="Administrative actions will be recorded here" /></div></td></tr>
                ) : rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-5 py-3.5 text-slate-300 whitespace-nowrap text-xs">{format(new Date(r.created_at), 'MMM d, HH:mm')}</td>
                    <td className="px-5 py-3.5 text-white whitespace-nowrap">{r.admin_email}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/10 capitalize">
                        {r.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-300 whitespace-nowrap">
                      {r.entity_type}{r.entity_id != null && <span className="text-slate-500 ml-1">#{r.entity_id}</span>}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 max-w-xs truncate">{r.details || '-'}</td>
                    <td className="px-5 py-3.5 text-slate-400 whitespace-nowrap">{r.ip_address || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-700 py-4">
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            {total > 0 && (
              <p className="text-center text-xs text-slate-500 mt-2">
                Showing {Math.min((page - 1) * LIMIT + 1, total)}–{Math.min(page * LIMIT, total)} of {total}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
