import { useState, useEffect } from 'react';
import { UserPlus, Pencil, Trash2, Clock, X, Loader2 } from 'lucide-react';
import { authHeaders } from './api';

interface Barber { id: number; name: string; phone: string; email: string; bio: string; experience: number; specialization: string; profile_image: string; rating: number; status: string; }
interface ScheduleEntry { id?: number; day_of_week: string; start_time: string; end_time: string; slot_duration: number; is_available: boolean; }

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const DF = { name:'', phone:'', email:'', bio:'', experience:0, specialization:'', profile_image:'' };

export function SalonBarbers() {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(DF);
  const [editing, setEditing] = useState<Barber | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [schedBarber, setSchedBarber] = useState<Barber | null>(null);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [savingSched, setSavingSched] = useState(false);

  const fetchAll = async () => {
    try {
      const r = await fetch('/api/salon/barbers', { headers: authHeaders() });
      if (!r.ok) throw new Error('Failed to fetch');
      setBarbers(await r.json());
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const saveBarber = async () => {
    setSaving(true);
    try {
      const url = editing ? `/api/salon/barbers/${editing.id}` : '/api/salon/barbers';
      const r = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: authHeaders(), body: JSON.stringify(form) });
      if (!r.ok) throw new Error('Failed to save');
      await fetchAll();
      setShowForm(false); setEditing(null); setForm(DF);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const delBarber = async (id: number) => {
    if (!window.confirm('Delete this barber?')) return;
    try {
      const r = await fetch(`/api/salon/barbers/${id}`, { method:'DELETE', headers: authHeaders() });
      if (!r.ok) throw new Error('Failed to delete');
      setBarbers((p) => p.filter((b) => b.id !== id));
    } catch (e: any) { setError(e.message); }
  };

  const edit = (b: Barber) => {
    setForm({ name:b.name, phone:b.phone, email:b.email, bio:b.bio, experience:b.experience, specialization:b.specialization, profile_image:b.profile_image });
    setEditing(b); setShowForm(true);
  };

  const openSched = (b: Barber) => {
    setSchedBarber(b);
    setSchedule(DAYS.map((d) => {
      const x = (b as any).schedule?.find((s: ScheduleEntry) => s.day_of_week === d);
      return x || { day_of_week: d, start_time:'09:00', end_time:'18:00', slot_duration:30, is_available:true };
    }));
  };

  const saveSched = async () => {
    if (!schedBarber) return;
    setSavingSched(true);
    try {
      const r = await fetch(`/api/salon/barbers/${schedBarber.id}/schedule`, { method:'PUT', headers: authHeaders(), body: JSON.stringify({ schedule }) });
      if (!r.ok) throw new Error('Failed to save schedule');
      await fetchAll();
      setSchedBarber(null);
    } catch (e: any) { setError(e.message); }
    finally { setSavingSched(false); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  if (error && !barbers.length) return <div className="flex items-center justify-center min-h-[60vh]"><div className="bg-red-50 text-red-700 px-6 py-4 rounded-xl border border-red-200 text-sm font-medium">{error}</div></div>;

  const fields: { key: keyof typeof DF; label: string; type?: string }[] = [
    { key:'name', label:'Name' }, { key:'phone', label:'Phone' }, { key:'email', label:'Email' },
    { key:'specialization', label:'Specialization' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Barbers</h1>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
          <UserPlus className="w-4 h-4" /> Add Barber
        </button>
      </div>
      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl border border-red-200 text-sm">{error}</div>}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Phone</th>
                <th className="px-6 py-3">Experience</th>
                <th className="px-6 py-3">Specialization</th>
                <th className="px-6 py-3">Rating</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!barbers.length ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400">No barbers added yet</td></tr>
              ) : barbers.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      {b.profile_image ? <img src={b.profile_image} alt="" className="w-8 h-8 rounded-full object-cover" />
                        : <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">{b.name[0]}</div>}
                      <div><p className="font-medium text-gray-900">{b.name}</p>{b.email && <p className="text-xs text-gray-400">{b.email}</p>}</div>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-gray-700 whitespace-nowrap">{b.phone || '—'}</td>
                  <td className="px-6 py-3.5 text-gray-700 whitespace-nowrap">{b.experience ? `${b.experience} yrs` : '—'}</td>
                  <td className="px-6 py-3.5 text-gray-700 max-w-[140px] truncate">{b.specialization || '—'}</td>
                  <td className="px-6 py-3.5 whitespace-nowrap">{b.rating ? <span className="text-amber-500 font-semibold">{b.rating} ★</span> : '—'}</td>
                  <td className="px-6 py-3.5 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${b.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{b.status || 'active'}</span>
                  </td>
                  <td className="px-6 py-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => edit(b)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => openSched(b)} className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Schedule"><Clock className="w-4 h-4" /></button>
                      <button onClick={() => delBarber(b.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => { setShowForm(false); setEditing(null); setForm(DF); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-5 relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => { setShowForm(false); setEditing(null); setForm(DF); }} className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit Barber' : 'Add Barber'}</h2>
            <div className="space-y-4">
              {fields.map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{f.label}{f.key==='name' && <span className="text-red-400 ml-1">*</span>}</label>
                  <input value={form[f.key] as string} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" placeholder={`Enter ${f.label.toLowerCase()}`} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Experience (yrs)</label>
                <input type="number" value={form.experience} onChange={(e) => setForm({ ...form, experience: Number(e.target.value) })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Bio</label>
                <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" placeholder="Brief bio..." />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Profile Image URL</label>
                <input value={form.profile_image} onChange={(e) => setForm({ ...form, profile_image: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" placeholder="https://..." />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => { setShowForm(false); setEditing(null); setForm(DF); }} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Cancel</button>
              <button onClick={saveBarber} disabled={saving || !form.name.trim()} className="px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-colors inline-flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}{editing ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {schedBarber && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setSchedBarber(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 space-y-5 relative max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSchedBarber(null)} className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-gray-900">Schedule — {schedBarber.name}</h2>
            <div className="space-y-3">
              {schedule.map((e, i) => (
                <div key={e.day_of_week} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-20 shrink-0"><p className="text-sm font-medium text-gray-700">{e.day_of_week.slice(0, 3)}</p></div>
                  <label className="flex items-center gap-2 text-sm text-gray-600 shrink-0">
                    <input type="checkbox" checked={e.is_available} onChange={(ev) => setSchedule((p) => p.map((s, j) => j === i ? { ...s, is_available: ev.target.checked } : s))} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-400" />
                    Available
                  </label>
                  <input type="time" value={e.start_time} onChange={(ev) => setSchedule((p) => p.map((s, j) => j === i ? { ...s, start_time: ev.target.value } : s))} disabled={!e.is_available} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-40" />
                  <span className="text-gray-400 text-xs">to</span>
                  <input type="time" value={e.end_time} onChange={(ev) => setSchedule((p) => p.map((s, j) => j === i ? { ...s, end_time: ev.target.value } : s))} disabled={!e.is_available} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-40" />
                  <div className="flex items-center gap-1.5 ml-auto">
                    <label className="text-xs text-gray-500 whitespace-nowrap">Slot:</label>
                    <input type="number" value={e.slot_duration} onChange={(ev) => setSchedule((p) => p.map((s, j) => j === i ? { ...s, slot_duration: Number(ev.target.value) } : s))} disabled={!e.is_available} className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-40" />
                    <span className="text-xs text-gray-400">min</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setSchedBarber(null)} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Cancel</button>
              <button onClick={saveSched} disabled={savingSched} className="px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-colors inline-flex items-center gap-2">
                {savingSched && <Loader2 className="w-4 h-4 animate-spin" />}Save Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
