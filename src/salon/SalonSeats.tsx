import { useState, useEffect } from 'react';
import { ArmchairIcon as Chair, Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react';
import { salonFetch } from './api';
import { useConfirm } from '../hooks/useConfirm';

interface Seat { id: number; name: string; status: string; assigned_staff_id: number | null; staff_name?: string; }

const STATUSES = ['Available', 'Occupied', 'Maintenance', 'Reserved'];

export function SalonSeats() {
  const { confirm, confirmDialog } = useConfirm();
  const [seats, setSeats] = useState<Seat[]>([]);
  const [barbers, setBarbers] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Seat | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', status: 'Available', assigned_staff_id: '' });

  const fetchAll = async (signal?: AbortSignal) => {
    try {
      const r = await salonFetch('/api/salon/seats', { signal });
      if (!r.ok) throw new Error('Failed to fetch');
      setSeats(await r.json());
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setError(e.message);
    }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const ac = new AbortController();
    fetchAll(ac.signal);
    salonFetch('/api/salon/barbers', { signal: ac.signal })
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setBarbers(Array.isArray(d) ? d : []))
      .catch(() => {});
    return () => ac.abort();
  }, []);

  const saveSeat = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const body = { name: form.name, status: form.status, assigned_staff_id: form.assigned_staff_id ? Number(form.assigned_staff_id) : null };
      const url = editing ? `/api/salon/seats/${editing.id}` : '/api/salon/seats';
      const r = await salonFetch(url, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(body) });
      if (!r.ok) throw new Error('Failed to save');
      await fetchAll();
      setShowForm(false); setEditing(null); setForm({ name: '', status: 'Available', assigned_staff_id: '' });
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const delSeat = async (id: number) => {
    const confirmed = await confirm('Delete Seat', 'Are you sure you want to delete this seat? This cannot be undone.', 'Delete', 'danger');
    if (!confirmed) return;
    try {
      const r = await salonFetch(`/api/salon/seats/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Failed to delete');
      setSeats((p) => p.filter((s) => s.id !== id));
    } catch (e: any) { setError(e.message); }
  };

  const edit = (s: Seat) => {
    setForm({ name: s.name, status: s.status, assigned_staff_id: s.assigned_staff_id ? String(s.assigned_staff_id) : '' });
    setEditing(s); setShowForm(true);
  };

  const statusColor = (st: string) => {
    switch (st) {
      case 'Available': return 'bg-emerald-100 text-emerald-700';
      case 'Occupied': return 'bg-amber-100 text-amber-700';
      case 'Maintenance': return 'bg-rose-100 text-rose-700';
      case 'Reserved': return 'bg-blue-100 text-blue-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;

  return (
    <div>
      {confirmDialog}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Seats</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your salon chairs and workstations</p>
        </div>
        <button type="button" onClick={() => { setEditing(null); setForm({ name: '', status: 'Available', assigned_staff_id: '' }); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-sm font-semibold">
          <Plus className="w-4 h-4" /> Add Seat
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-rose-50 text-rose-600 rounded-xl text-sm">{error}</div>}

      {showForm && (
        <div className="mb-6 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-700">{editing ? 'Edit Seat' : 'New Seat'}</h3>
            <button type="button" onClick={() => setShowForm(false)} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="Chair 1" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Staff (optional)</label>
              <select value={form.assigned_staff_id} onChange={(e) => setForm({ ...form, assigned_staff_id: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                <option value="">Unassigned</option>
                {barbers.map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-all">Cancel</button>
            <button type="button" onClick={saveSeat} disabled={saving || !form.name.trim()} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all">
              {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {seats.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-400">
            <Chair className="w-12 h-12 mb-3" />
            <p className="text-sm font-medium">No seats yet</p>
            <p className="text-xs mt-1">Add your first seat to get started</p>
          </div>
        ) : seats.map((seat) => (
          <div key={seat.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <Chair className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">{seat.name}</h3>
                  {seat.staff_name && <p className="text-xs text-slate-400 mt-0.5">{seat.staff_name}</p>}
                </div>
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={() => edit(seat)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"><Pencil className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => delSeat(seat.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <div className="mt-3">
              <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${statusColor(seat.status)}`}>{seat.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
