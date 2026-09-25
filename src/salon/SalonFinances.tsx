import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DollarSign, TrendingUp, TrendingDown, Loader2, Plus, Trash2, X, List, Pencil } from 'lucide-react';
import { salonFetch } from './api';
import { useConfirm } from '../hooks/useConfirm';

interface FinOverview { revenue: number; expenses: number; profit: number; }
interface FinEntry { id: number; amount: number; date: string; description?: string; category?: string; }

export function SalonFinances() {
  const { confirm, confirmDialog } = useConfirm();
  const [data, setData] = useState<FinOverview | null>(null);
  const [revenueList, setRevenueList] = useState<FinEntry[]>([]);
  const [expenseList, setExpenseList] = useState<FinEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'overview' | 'revenue' | 'expenses'>('overview');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'revenue' | 'expense'>('revenue');
  const [editing, setEditing] = useState<FinEntry | null>(null);
  const [form, setForm] = useState({ amount: '', date: '', description: '', category: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [fin, rev, exp] = await Promise.all([
        salonFetch('/api/salon/finances').then(r => r.ok ? r.json() : null),
        salonFetch('/api/salon/revenue').then(r => r.ok ? r.json() : []),
        salonFetch('/api/salon/expenses').then(r => r.ok ? r.json() : []),
      ]);
      setData(fin);
      setRevenueList(rev);
      setExpenseList(exp);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = (type: 'revenue' | 'expense') => {
    setEditing(null);
    setModalType(type);
    setForm({ amount: '', date: new Date().toISOString().split('T')[0], description: '', category: '' });
    setShowModal(true);
  };

  const openEdit = (type: 'revenue' | 'expense', entry: FinEntry) => {
    setEditing(entry);
    setModalType(type);
    setForm({
      amount: String(entry.amount),
      date: entry.date ? entry.date.split('T')[0] : new Date().toISOString().split('T')[0],
      description: entry.description || '',
      category: entry.category || '',
    });
    setShowModal(true);
  };

  const saveEntry = async () => {
    if (!form.amount || !form.date) return;
    if (modalType === 'expense' && !form.description) return;
    setError('');
    try {
      if (editing) {
        const ep = modalType === 'expense' ? 'expenses' : 'revenue';
        const url = `/api/salon/${ep}/${editing.id}`;
        const body = modalType === 'revenue'
          ? { amount: form.amount, date: form.date }
          : { amount: form.amount, date: form.date, description: form.description, category: form.category };
        const r = await salonFetch(url, { method: 'PUT', body: JSON.stringify(body) });
        if (!r.ok) throw new Error('Failed to update');
      } else {
        const ep = modalType === 'expense' ? 'expenses' : 'revenue';
        const url = `/api/salon/${ep}`;
        const body = modalType === 'revenue'
          ? { amount: form.amount, date: form.date }
          : { amount: form.amount, date: form.date, description: form.description, category: form.category };
        const r = await salonFetch(url, { method: 'POST', body: JSON.stringify(body) });
        if (!r.ok) throw new Error('Failed to create');
      }
      setShowModal(false);
      setForm({ amount: '', date: '', description: '', category: '' });
      fetchData();
    } catch (e: any) { setError(e.message); }
  };

  const deleteEntry = async (type: 'revenue' | 'expense', id: number) => {
    const confirmed = await confirm(`Delete ${type === 'revenue' ? 'Revenue' : 'Expense'} Entry`, `Are you sure you want to delete this ${type} entry? This action cannot be undone.`, 'Delete', 'danger');
    if (!confirmed) return;
    try {
      const ep = type === 'expense' ? 'expenses' : 'revenue';
      const r = await salonFetch(`/api/salon/${ep}/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Failed');
      fetchData();
    } catch (e: any) { setError(e.message); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-amber-600" /></div>;

  const cards = [
    { label: 'Total Revenue', value: data?.revenue || 0, icon: TrendingUp, color: 'from-emerald-500 to-emerald-600', prefix: 'PKR ' },
    { label: 'Total Expenses', value: data?.expenses || 0, icon: TrendingDown, color: 'from-rose-500 to-rose-600', prefix: 'PKR ' },
    { label: 'Net Profit', value: data?.profit || 0, icon: DollarSign, color: 'from-amber-500 to-orange-600', prefix: 'PKR ' },
  ];

  return (<>
    <div className="max-w-7xl mx-auto space-y-6">
      {confirmDialog}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Finances</h1>
          <p className="text-sm text-slate-500 mt-1">Revenue, expenses, and profit overview</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => openCreate('revenue')}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all text-sm font-semibold">
            <Plus className="w-4 h-4" /> Revenue
          </button>
          <button type="button" onClick={() => openCreate('expense')}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all text-sm font-semibold">
            <Plus className="w-4 h-4" /> Expense
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-rose-50 text-rose-600 rounded-xl text-sm">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-slate-500">{c.label}</span>
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${c.color} flex items-center justify-center`}>
                <c.icon className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-800">{c.prefix}{Number(c.value).toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-b border-slate-200">
        {(['overview', 'revenue', 'expenses'] as const).map(t => (
          <button type="button" key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all capitalize ${tab === t ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700'}`}>
            {t === 'revenue' ? 'Revenue Entries' : t === 'expenses' ? 'Expense Entries' : 'Overview'}
          </button>
        ))}
      </div>

      {tab === 'revenue' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <th className="px-6 py-3">Date</th><th className="px-6 py-3">Amount</th><th className="px-6 py-3 w-24"></th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {revenueList.length === 0
                ? <tr><td colSpan={3} className="px-6 py-8 text-center text-slate-400">No revenue entries</td></tr>
                : revenueList.map((r: any) => (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-3 text-slate-700">{r.date ? new Date(r.date).toLocaleDateString('en-IN') : '—'}</td>
                      <td className="px-6 py-3 font-semibold text-emerald-600">PKR {Number(r.amount).toLocaleString()}</td>
                      <td className="px-6 py-3">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button type="button" onClick={() => openEdit('revenue', r)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
                          <button type="button" onClick={() => deleteEntry('revenue', r.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {tab === 'expenses' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <th className="px-6 py-3">Date</th><th className="px-6 py-3">Description</th><th className="px-6 py-3">Category</th><th className="px-6 py-3">Amount</th><th className="px-6 py-3 w-24"></th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {expenseList.length === 0
                ? <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">No expense entries</td></tr>
                : expenseList.map((e: any) => (
                    <tr key={e.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-3 text-slate-700">{e.date ? new Date(e.date).toLocaleDateString('en-IN') : '—'}</td>
                      <td className="px-6 py-3 text-slate-700">{e.description}</td>
                      <td className="px-6 py-3"><span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{e.category || '—'}</span></td>
                      <td className="px-6 py-3 font-semibold text-rose-600">PKR {Number(e.amount).toLocaleString()}</td>
                      <td className="px-6 py-3">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button type="button" onClick={() => openEdit('expense', e)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
                          <button type="button" onClick={() => deleteEntry('expense', e.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {tab === 'overview' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-400 text-sm">
          <List className="w-8 h-8 mx-auto mb-2 opacity-40" />
          Switch to "Revenue Entries" or "Expense Entries" tab to manage individual entries.
        </div>
      )}
    </div>

    <AnimatePresence>
      {showModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowModal(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-800 capitalize">{editing ? 'Edit' : 'Add'} {modalType}</h2>
              <button type="button" onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Date</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Amount (PKR)</label>
                <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" placeholder="0" />
              </div>
              {modalType === 'expense' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Description</label>
                    <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" placeholder="e.g. Supplies, Rent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Category</label>
                    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300">
                      <option value="">—</option>
                      <option value="Supplies">Supplies</option>
                      <option value="Rent">Rent</option>
                      <option value="Utilities">Utilities</option>
                      <option value="Salary">Salary</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all">Cancel</button>
              <button type="button" onClick={saveEntry} disabled={!form.amount || !form.date || (modalType === 'expense' && !form.description)}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-all disabled:opacity-50">
                {editing ? 'Update' : 'Add'} {modalType}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
