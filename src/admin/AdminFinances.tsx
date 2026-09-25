import { useState, useEffect, useCallback } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Plus, Pencil, Trash2, X } from 'lucide-react';
import { useAdminAuth } from './AdminAuthContext';
import SalonLocationFilter from './SalonLocationFilter';
import { useConfirm } from '../hooks/useConfirm';
import { Pagination } from '../components/Pagination';

export function AdminFinances() {
  const { adminFetch } = useAdminAuth();
  const { confirm, confirmDialog } = useConfirm();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [revenues, setRevenues] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [tab, setTab] = useState<'overview' | 'revenue' | 'expenses'>('overview');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [type, setType] = useState<'revenue' | 'expenses'>('revenue');
  const [form, setForm] = useState({ amount: '', description: '', salon_id: '', date: '' });
  const [salons, setSalons] = useState<any[]>([]);
  const [salonFilter, setSalonFilter] = useState('');
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const load = useCallback(async (sid?: string, signal?: AbortSignal) => {
    setLoading(true);
    try {
      const fUrl = sid ? `/api/admin/finances?salonId=${sid}` : '/api/admin/finances';
      const rUrl = sid ? `/api/admin/revenue?salonId=${sid}` : '/api/admin/revenue';
      const eUrl = sid ? `/api/admin/expenses?salonId=${sid}` : '/api/admin/expenses';
      const [fRes, rRes, eRes] = await Promise.all([
        adminFetch(fUrl, { signal }),
        adminFetch(rUrl, { signal }),
        adminFetch(eUrl, { signal }),
      ]);
      if (fRes.ok) setData(await fRes.json());
      if (rRes.ok) setRevenues(await rRes.json());
      if (eRes.ok) setExpenses(await eRes.json());
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
    } finally { setLoading(false); }
  }, [adminFetch]);

  useEffect(() => {
    const ac = new AbortController();
    load(salonFilter, ac.signal);
    return () => ac.abort();
  }, [salonFilter, load]);

  useEffect(() => { setPage(1); }, [tab, salonFilter]);

  const openCreate = (t: 'revenue' | 'expenses') => {
    setType(t);
    setEditing(null);
    setForm({ amount: '', description: '', salon_id: '', date: new Date().toISOString().split('T')[0] });
    setShowModal(true);
  };

  const openEdit = (item: any, t: 'revenue' | 'expenses') => {
    setType(t);
    setEditing(item);
    setForm({ amount: String(item.amount), description: item.description || '', salon_id: String(item.salon_id || ''), date: item.date || new Date().toISOString().split('T')[0] });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.amount || !form.salon_id) return;
    if (type === 'revenue' && !form.date) return; // Date required for revenue
    const endpoint = type === 'revenue' ? '/api/admin/revenue' : '/api/admin/expenses';
    try {
      const body = { amount: +form.amount, description: form.description, salon_id: +form.salon_id, date: form.date || new Date().toISOString().split('T')[0] };
      if (editing) {
        const res = await adminFetch(`${endpoint}/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) });
        if (!res.ok) throw new Error('Failed');
      } else {
        const res = await adminFetch(endpoint, { method: 'POST', body: JSON.stringify(body) });
        if (!res.ok) throw new Error('Failed');
      }
      setShowModal(false);
      load();
    } catch (e: any) { alert(e.message); }
  };

  const del = async (id: number, t: 'revenue' | 'expenses') => {
    const confirmed = await confirm(`Delete ${t === 'revenue' ? 'Revenue' : 'Expense'} Entry`, `Are you sure you want to delete this ${t} entry? This action cannot be undone.`, 'Delete');
    if (!confirmed) return;
    const endpoint = t === 'revenue' ? '/api/admin/revenue' : '/api/admin/expenses';
    try {
      const res = await adminFetch(`${endpoint}/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (t === 'revenue') setRevenues(prev => prev.filter((r: any) => r.id !== id));
        else setExpenses(prev => prev.filter((e: any) => e.id !== id));
      }
    } catch (err) {
      console.error('[AdminFinances] Failed to delete entry:', err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-700/50 rounded-lg w-36 mb-2" />
          <div className="h-4 bg-slate-700/50 rounded w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-slate-800 rounded-xl border border-slate-700 p-6 animate-pulse">
              <div className="flex items-center justify-between mb-4">
                <div className="h-4 bg-slate-700 rounded w-24" />
                <div className="w-10 h-10 bg-slate-700 rounded-lg" />
              </div>
              <div className="h-7 bg-slate-700 rounded w-28" />
            </div>
          ))}
        </div>
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden animate-pulse">
          <div className="p-4 border-b border-slate-700">
            <div className="h-4 bg-slate-700 rounded w-32" />
          </div>
          <div className="space-y-1 p-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <div className="h-4 bg-slate-700 rounded w-24" />
                <div className="h-4 bg-slate-700 rounded w-36" />
                <div className="h-4 bg-slate-700 rounded w-20 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const cards = [
    { label: 'Total Revenue', value: data?.revenue || 0, icon: TrendingUp, color: 'from-emerald-500 to-emerald-600', prefix: 'PKR ' },
    { label: 'Total Expenses', value: data?.expenses || 0, icon: TrendingDown, color: 'from-rose-500 to-rose-600', prefix: 'PKR ' },
    { label: 'Net Profit', value: data?.profit || 0, icon: DollarSign, color: 'from-indigo-500 to-indigo-600', prefix: 'PKR ' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Platform Finances</h1>
        <SalonLocationFilter salonFilter={salonFilter} setSalonFilter={setSalonFilter} salons={salons} setSalons={setSalons} adminFetch={adminFetch} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-slate-400">{c.label}</span>
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${c.color} flex items-center justify-center`}>
                <c.icon className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{c.prefix}{Number(c.value).toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 mb-6 bg-slate-800/50 rounded-xl p-1 border border-slate-700/50 w-fit">
        {(['overview', 'revenue', 'expenses'] as const).map(t => (
          <button type="button" key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${tab === t ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-emerald-400">Recent Revenue</h4>
                <button type="button" onClick={() => openCreate('revenue')} className="text-xs text-indigo-400 hover:text-indigo-300">+ Add</button>
              </div>
              {revenues.slice(0, 5).length === 0 ? (
                <p className="text-sm text-slate-500">No revenue entries yet</p>
              ) : revenues.slice(0, 5).map((r: any) => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
                  <div><p className="text-sm text-white">{r.description || 'Revenue'}</p><p className="text-xs text-slate-500">{r.salon_name}</p></div>
                  <span className="text-sm font-semibold text-emerald-400">+PKR {r.amount}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-rose-400">Recent Expenses</h4>
                <button type="button" onClick={() => openCreate('expenses')} className="text-xs text-indigo-400 hover:text-indigo-300">+ Add</button>
              </div>
              {expenses.slice(0, 5).length === 0 ? (
                <p className="text-sm text-slate-500">No expenses entries yet</p>
              ) : expenses.slice(0, 5).map((e: any) => (
                <div key={e.id} className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
                  <div><p className="text-sm text-white">{e.description || 'Expense'}</p><p className="text-xs text-slate-500">{e.salon_name}</p></div>
                  <span className="text-sm font-semibold text-rose-400">-PKR {e.amount}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'revenue' && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300">All Revenue Entries</h3>
            <button type="button" onClick={() => openCreate('revenue')}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-500 transition-all">
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Salon</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Description</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Amount</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {revenues.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-12 text-slate-500 text-sm">No revenue entries</td></tr>
              ) : revenues.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE).map((r: any) => (
                <tr key={r.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 group">
                  <td className="px-4 py-3 text-sm text-white">{r.salon_name}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{r.description || '-'}</td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-emerald-400">PKR {Number(r.amount).toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button type="button" onClick={() => openEdit(r, 'revenue')}
                        className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => del(r.id, 'revenue')}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div className="border-t border-slate-700">
            <Pagination page={page} totalPages={Math.ceil(revenues.length / ITEMS_PER_PAGE)} onPageChange={setPage} />
          </div>
        </div>
      )}

      {tab === 'expenses' && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300">All Expense Entries</h3>
            <button type="button" onClick={() => openCreate('expenses')}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-500 transition-all">
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Salon</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Description</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Amount</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-12 text-slate-500 text-sm">No expense entries</td></tr>
              ) : expenses.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE).map((e: any) => (
                <tr key={e.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 group">
                  <td className="px-4 py-3 text-sm text-white">{e.salon_name}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{e.description || '-'}</td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-rose-400">PKR {Number(e.amount).toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button type="button" onClick={() => openEdit(e, 'expenses')}
                        className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => del(e.id, 'expenses')}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div className="border-t border-slate-700">
            <Pagination page={page} totalPages={Math.ceil(expenses.length / ITEMS_PER_PAGE)} onPageChange={setPage} />
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowModal(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white capitalize">{editing ? 'Edit' : 'Add'} {type}</h2>
              <button type="button" onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-white rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Salon</label>
                <select value={form.salon_id} onChange={(e) => setForm({ ...form, salon_id: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select Salon</option>
                  {salons.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Amount (PKR)</label>
                <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Date</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 border border-slate-600 text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-700 transition-all">Cancel</button>
              <button type="button" onClick={save}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-all">
                {editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
