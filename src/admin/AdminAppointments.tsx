import { useState, useEffect } from 'react';
import { Calendar, Search, Loader2, Store, User, Scissors } from 'lucide-react';
import { format } from 'date-fns';

const STATUSES = ['', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];

export function AdminAppointments() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ salon_id: '', status: '', date: '' });

  const hd = () => ({ Authorization: `Bearer ${localStorage.getItem('admin-token')}`, 'Content-Type': 'application/json' });

  const fetchAll = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.salon_id) params.set('salon_id', filter.salon_id);
      if (filter.status) params.set('status', filter.status);
      if (filter.date) params.set('date', filter.date);
      const res = await fetch(`/api/admin/appointments?${params}`, { headers: hd() });
      if (res.ok) setAppointments(await res.json());
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => { fetchAll(); }, [filter]);

  const statusBadge = (st: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-amber-500/20 text-amber-400',
      confirmed: 'bg-blue-500/20 text-blue-400',
      in_progress: 'bg-violet-500/20 text-violet-400',
      completed: 'bg-emerald-500/20 text-emerald-400',
      cancelled: 'bg-rose-500/20 text-rose-400',
      no_show: 'bg-slate-500/20 text-slate-400',
    };
    return colors[st] || 'bg-slate-500/20 text-slate-400';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Appointments</h1>
          <p className="text-sm text-slate-400 mt-1">All appointments across all salons</p>
        </div>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <input placeholder="Date (YYYY-MM-DD)" value={filter.date} onChange={(e) => setFilter({ ...filter, date: e.target.value })}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 w-40" />
        <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All Status</option>
          {STATUSES.filter(Boolean).map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>
      ) : (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Salon</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Barber</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Service</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {appointments.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-500 text-sm">No appointments found</td></tr>
              ) : appointments.map((a: any) => (
                <tr key={a.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="px-4 py-3"><span className="flex items-center gap-1.5 text-sm text-white"><Store className="w-3.5 h-3.5 text-slate-400" />{a.salon_name}</span></td>
                  <td className="px-4 py-3"><span className="flex items-center gap-1.5 text-sm text-slate-200"><User className="w-3.5 h-3.5 text-slate-400" />{a.customer_name || a.customer_phone}</span></td>
                  <td className="px-4 py-3 text-sm text-slate-300">{a.barber_name}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{a.service_name}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{format(new Date(a.appointment_date), 'MMM d, yyyy')}</td>
                  <td className="px-4 py-3"><span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge(a.status)}`}>{a.status?.replace('_', ' ')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
