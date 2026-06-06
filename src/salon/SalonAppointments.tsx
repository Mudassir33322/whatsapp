import { useState, useEffect } from 'react';
import { Calendar, CheckCircle, Play, XCircle, Loader2 } from 'lucide-react';
import { authHeaders } from './api';

interface Appointment {
  id: number;
  appointment_time: string;
  end_time: string;
  customer_name: string;
  customer_phone?: string;
  barber_name?: string;
  service_name?: string;
  token?: string;
  status: string;
}

interface Barber { id: number; name: string; }

const STATUS_OPTIONS = ['all', 'confirmed', 'in_progress', 'completed', 'cancelled'];

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  no_show: 'bg-gray-100 text-gray-600',
};

const TODAY = new Date().toISOString().split('T')[0];

export function SalonAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [date, setDate] = useState(TODAY);
  const [barberId, setBarberId] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchAppointments = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ date });
      if (barberId) params.set('barber_id', barberId);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const r = await fetch(`/api/salon/appointments?${params}`, { headers: authHeaders() });
      if (!r.ok) throw new Error('Failed to fetch appointments');
      setAppointments(await r.json());
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const fetchBarbers = async () => {
    try {
      const r = await fetch('/api/salon/barbers', { headers: authHeaders() });
      if (r.ok) setBarbers(await r.json());
    } catch {}
  };

  useEffect(() => { fetchBarbers(); }, []);
  useEffect(() => { fetchAppointments(); }, [date, barberId, statusFilter]);

  const updateStatus = async (id: number, status: string) => {
    try {
      const r = await fetch(`/api/salon/appointments/${id}/status`, {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error('Failed to update status');
      setAppointments((p) => p.map((a) => a.id === id ? { ...a, status } : a));
    } catch (e: any) { setError(e.message); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  if (error && !appointments.length) return <div className="flex items-center justify-center min-h-[60vh]"><div className="bg-red-50 text-red-700 px-6 py-4 rounded-xl border border-red-200 text-sm font-medium">{error}</div></div>;

  const renderActions = (a: Appointment) => {
    const btns: { status: string; icon: typeof CheckCircle; label: string; cls: string }[] = [];
    if (a.status === 'pending') btns.push({ status: 'confirmed', icon: CheckCircle, label: 'Confirm', cls: 'text-emerald-600 hover:bg-emerald-50' });
    if (a.status === 'confirmed') btns.push({ status: 'in_progress', icon: Play, label: 'Start', cls: 'text-blue-600 hover:bg-blue-50' });
    if (a.status === 'in_progress') btns.push({ status: 'completed', icon: CheckCircle, label: 'Complete', cls: 'text-green-600 hover:bg-green-50' });
    if (!['cancelled', 'no_show'].includes(a.status)) btns.push({ status: 'cancelled', icon: XCircle, label: 'Cancel', cls: 'text-red-600 hover:bg-red-50' });
    return btns.map((b) => (
      <button key={b.status} onClick={() => updateStatus(a.id, b.status)} className={`p-2 rounded-lg transition-colors ${b.cls}`} title={b.label}>
        <b.icon className="w-4 h-4" />
      </button>
    ));
  };

  const fmtStatus = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="pl-9 pr-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
        </div>
        <select value={barberId} onChange={(e) => setBarberId(e.target.value)}
          className="px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent">
          <option value="">All Barbers</option>
          {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent">
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s === 'all' ? 'All Status' : fmtStatus(s)}</option>
          ))}
        </select>
      </div>
      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl border border-red-200 text-sm">{error}</div>}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3">Time</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Barber</th>
                <th className="px-6 py-3">Service</th>
                <th className="px-6 py-3">Token</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!appointments.length ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400">No appointments found</td></tr>
              ) : appointments.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3.5 text-gray-900 font-medium whitespace-nowrap">
                    {new Date(a.appointment_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-6 py-3.5">
                    <div>
                      <p className="font-medium text-gray-900">{a.customer_name}</p>
                      {a.customer_phone && <p className="text-xs text-gray-400">{a.customer_phone}</p>}
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-gray-700 whitespace-nowrap">{a.barber_name || '—'}</td>
                  <td className="px-6 py-3.5 text-gray-700 whitespace-nowrap">{a.service_name || '—'}</td>
                  <td className="px-6 py-3.5 whitespace-nowrap">
                    {a.token && (
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                        {a.token}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3.5 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[a.status] || 'bg-gray-100 text-gray-600'}`}>
                      {fmtStatus(a.status)}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {renderActions(a)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
