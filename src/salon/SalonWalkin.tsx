import { useState, useEffect, useMemo } from 'react';
import { UserPlus, Loader2, Calendar, Clock, CheckCircle, List, Pencil, Trash2, X } from 'lucide-react';
import { salonFetch } from './api';
import { Pagination } from '../components/Pagination';
import { useConfirm } from '../hooks/useConfirm';

interface Service { id: number; name: string; duration: number; price: number; }
interface Barber { id: number; name: string; }
interface Walkin { id: number; customer_name: string; customer_phone: string; service_name: string; barber_name: string; service_id?: number; barber_id?: number; appointment_date: string; appointment_time: string; end_time: string; token: string; status: string; }

export function SalonWalkin() {
  const { confirm, confirmDialog } = useConfirm();
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [walkins, setWalkins] = useState<Walkin[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ token: string; name: string } | null>(null);
  const [tab, setTab] = useState<'add' | 'list'>('add');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Walkin | null>(null);
  const [form, setForm] = useState({
    phone: '', name: '', service_id: '', barber_id: '',
    appointment_date: new Date().toISOString().split('T')[0],
    appointment_time: ''
  });
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    const ac = new AbortController();
    salonFetch('/api/salon/services', { signal: ac.signal })
      .then((r) => r.ok ? r.json() : []).then((d) => setServices(Array.isArray(d) ? d : [])).catch((err) => { console.error('[SalonWalkin] Failed to load services:', err); });
    salonFetch('/api/salon/barbers', { signal: ac.signal })
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setBarbers(Array.isArray(d) ? d : []))
      .catch(() => setBarbers([]));
    const now = new Date();
    now.setHours(now.getHours() + 1, 0, 0, 0);
    setForm((f) => ({ ...f, appointment_time: `${String(now.getHours()).padStart(2, '0')}:00` }));
    return () => ac.abort();
  }, []);

  const fetchWalkins = async (signal?: AbortSignal) => {
    try {
      const r = await salonFetch('/api/salon/walkins', { signal });
      if (r.ok) setWalkins(await r.json());
    } catch (err) {
      console.error('[SalonWalkin] Failed to fetch walkins:', err);
      if (!signal?.aborted) setError(err instanceof Error ? err.message : 'Failed to load walkins');
    }
    finally { setLoading(false); }
  };

  useEffect(() => { const ac = new AbortController(); fetchWalkins(ac.signal); return () => ac.abort(); }, []);

  const submit = async () => {
    if (!form.phone || !form.service_id || !form.appointment_date || !form.appointment_time) {
      setError('Phone, Service, Date, and Time are required');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess(null);
    try {
      const r = await salonFetch('/api/salon/walkin', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed');
      setSuccess({ token: data.token, name: form.name || form.phone });
      setForm((f) => ({ ...f, phone: '', name: '', service_id: '', barber_id: '' }));
      fetchWalkins();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const openEdit = (w: Walkin) => {
    setEditing(w);
    setForm({
      phone: w.customer_phone || '',
      name: w.customer_name || '',
      service_id: String(w.service_id || ''),
      barber_id: String(w.barber_id || ''),
      appointment_date: w.appointment_date,
      appointment_time: w.appointment_time,
    });
    setShowModal(true);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const r = await salonFetch(`/api/salon/walkins/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          customer_name: form.name,
          customer_phone: form.phone,
          service_id: form.service_id ? Number(form.service_id) : undefined,
          barber_id: form.barber_id ? Number(form.barber_id) : undefined,
          appointment_date: form.appointment_date,
          appointment_time: form.appointment_time,
        }),
      });
      if (!r.ok) throw new Error('Failed to update');
      setShowModal(false);
      setEditing(null);
      fetchWalkins();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const deleteWalkin = async (id: number) => {
    const confirmed = await confirm('Delete Walk-in', 'Are you sure you want to delete this walk-in booking? This cannot be undone.', 'Delete', 'danger');
    if (!confirmed) return;
    try {
      const r = await salonFetch(`/api/salon/walkins/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Failed to delete');
      setWalkins((p) => p.filter((w) => w.id !== id));
    } catch (e: any) { setError(e.message); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-amber-600" /></div>;

  return (
    <div className="max-w-4xl mx-auto">
      {confirmDialog}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Walk-in Bookings</h1>
          <p className="text-sm text-slate-500 mt-1">Manage walk-in customer appointments</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setTab('add')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === 'add' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            <UserPlus className="w-4 h-4 inline mr-1" /> New Walk-in
          </button>
          <button type="button" onClick={() => setTab('list')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === 'list' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            <List className="w-4 h-4 inline mr-1" /> All Bookings
          </button>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-rose-50 text-rose-600 rounded-xl text-sm">{error}</div>}

      {tab === 'add' ? (
        <>
          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl">
              <div className="flex items-center gap-2 text-green-700 font-semibold mb-1"><CheckCircle className="w-5 h-5" /> Booking Created!</div>
              <p className="text-sm text-green-600">Customer: {success.name} | Token: <strong>{success.token}</strong></p>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Phone *</label>
                <input placeholder="03XXXXXXXXX" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Customer Name</label>
                <input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Service *</label>
              <select value={form.service_id} onChange={(e) => setForm({ ...form, service_id: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none bg-white">
                <option value="">Select service...</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name} (Rs.{s.price} / {s.duration}min)</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Barber (optional)</label>
              <select value={form.barber_id} onChange={(e) => setForm({ ...form, barber_id: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none bg-white">
                <option value="">Auto-assign</option>
                {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Date *</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="date" value={form.appointment_date} onChange={(e) => setForm({ ...form, appointment_date: e.target.value })} className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Time *</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="time" value={form.appointment_time} onChange={(e) => setForm({ ...form, appointment_time: e.target.value })} className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none" />
                </div>
              </div>
            </div>

            <button type="button" onClick={submit} disabled={saving} className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 text-white rounded-xl hover:bg-amber-600 font-semibold text-sm transition-all disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              {saving ? 'Creating...' : 'Add Walk-in Booking'}
            </button>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left p-3 font-semibold text-slate-600">Customer</th>
                <th className="text-left p-3 font-semibold text-slate-600">Phone</th>
                <th className="text-left p-3 font-semibold text-slate-600">Service</th>
                <th className="text-left p-3 font-semibold text-slate-600">Barber</th>
                <th className="text-left p-3 font-semibold text-slate-600">Date</th>
                <th className="text-left p-3 font-semibold text-slate-600">Token</th>
                <th className="text-left p-3 font-semibold text-slate-600 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {walkins.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-400">No walk-in bookings yet</td></tr>
              ) : walkins.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE).map((w) => (
                <tr key={w.id} className="hover:bg-slate-50 group">
                  <td className="p-3 font-medium text-slate-700">{w.customer_name}</td>
                  <td className="p-3 text-slate-500">{w.customer_phone}</td>
                  <td className="p-3 text-slate-500">{w.service_name || '—'}</td>
                  <td className="p-3 text-slate-500">{w.barber_name || '—'}</td>
                  <td className="p-3 text-slate-500">{new Date(w.appointment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} {w.appointment_time}</td>
                  <td className="p-3"><span className="text-xs font-bold px-2 py-1 bg-amber-100 text-amber-700 rounded-lg">{w.token}</span></td>
                  <td className="p-3">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button type="button" onClick={() => openEdit(w)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => deleteWalkin(w.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <Pagination page={page} totalPages={Math.ceil(walkins.length / ITEMS_PER_PAGE)} onPageChange={setPage} />
        </div>
      )}

      {showModal && editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowModal(false)}>
          <div onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-amber-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-800">Edit Booking</h2>
              <button type="button" onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Customer Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Phone</label>
                <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-4 py-2.5 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Service</label>
                <select value={form.service_id} onChange={(e) => setForm({ ...form, service_id: e.target.value })}
                  className="w-full px-4 py-2.5 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white">
                  <option value="">Select service...</option>
                  {services.map((s) => <option key={s.id} value={String(s.id)}>{s.name} (Rs.{s.price} / {s.duration}min)</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Barber (optional)</label>
                <select value={form.barber_id} onChange={(e) => setForm({ ...form, barber_id: e.target.value })}
                  className="w-full px-4 py-2.5 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white">
                  <option value="">Auto-assign</option>
                  {barbers.map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Date</label>
                  <input type="date" value={form.appointment_date} onChange={(e) => setForm({ ...form, appointment_date: e.target.value })}
                    className="w-full px-4 py-2.5 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Time</label>
                  <input type="time" value={form.appointment_time} onChange={(e) => setForm({ ...form, appointment_time: e.target.value })}
                    className="w-full px-4 py-2.5 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 border border-amber-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-amber-50 transition-all">Cancel</button>
              <button type="button" onClick={saveEdit} disabled={saving}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-all disabled:opacity-50">
                {saving ? 'Saving...' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
