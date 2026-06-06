import { useState, useEffect } from 'react';
import { UserPlus, Loader2, Calendar, Clock, CheckCircle } from 'lucide-react';
import { authHeaders } from './api';

interface Service { id: number; name: string; duration: number; price: number; }
interface Barber { id: number; name: string; }

export function SalonWalkin() {
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ token: string; name: string } | null>(null);
  const [form, setForm] = useState({
    phone: '',
    name: '',
    service_id: '',
    barber_id: '',
    appointment_date: new Date().toISOString().split('T')[0],
    appointment_time: ''
  });

  useEffect(() => {
    fetch('/api/salon/services', { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setServices(d))
      .catch(() => {});
    fetch('/api/salon/barbers', { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setBarbers(d))
      .catch(() => {});
    // Set default time to next hour
    const now = new Date();
    now.setHours(now.getHours() + 1, 0, 0, 0);
    setForm((f) => ({ ...f, appointment_time: `${String(now.getHours()).padStart(2, '0')}:00` }));
  }, []);

  const submit = async () => {
    if (!form.phone || !form.service_id || !form.appointment_date || !form.appointment_time) {
      setError('Phone, Service, Date, and Time are required');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess(null);
    try {
      const r = await fetch('/api/salon/walkin', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(form)
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed');
      setSuccess({ token: data.token, name: form.name || form.phone });
      setForm((f) => ({ ...f, phone: '', name: '', service_id: '', barber_id: '' }));
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Walk-in Entry</h1>
        <p className="text-sm text-slate-500 mt-1">Manually add a customer appointment (no WhatsApp needed)</p>
      </div>

      {error && <div className="mb-4 p-3 bg-rose-50 text-rose-600 rounded-xl text-sm">{error}</div>}

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
            <input placeholder="03XXXXXXXXX" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Customer Name</label>
            <input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">Service *</label>
          <select value={form.service_id} onChange={(e) => setForm({ ...form, service_id: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white">
            <option value="">Select service...</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name} (Rs.{s.price} / {s.duration}min)</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">Barber (optional)</label>
          <select value={form.barber_id} onChange={(e) => setForm({ ...form, barber_id: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white">
            <option value="">Auto-assign</option>
            {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Date *</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="date" value={form.appointment_date} onChange={(e) => setForm({ ...form, appointment_date: e.target.value })} className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Time *</label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="time" value={form.appointment_time} onChange={(e) => setForm({ ...form, appointment_time: e.target.value })} className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
            </div>
          </div>
        </div>

        <button onClick={submit} disabled={saving} className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-semibold text-sm transition-all disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          {saving ? 'Creating...' : 'Add Walk-in Booking'}
        </button>
      </div>
    </div>
  );
}
