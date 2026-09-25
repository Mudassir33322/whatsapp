import React, { useEffect, useState } from 'react';
import { useCustomerAuth } from './CustomerAuthContext';
import { Calendar, CheckCircle, Star, Loader2 } from 'lucide-react';

interface Appointment {
  id: number;
  status: string;
}

export function CustomerDashboard() {
  const { customer, customerFetch } = useCustomerAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const res = await customerFetch('/api/customer/appointments', { signal: ac.signal });
        if (res.ok) {
          const data = await res.json();
          setAppointments(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
      setLoading(false);
    })();
    return () => ac.abort();
  }, [customerFetch]);

  const upcomingCount = appointments.filter(a => a.status === 'confirmed' || a.status === 'scheduled').length;
  const totalCount = appointments.length;
  const points = customer?.loyalty_points ?? 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Welcome back{customer?.name ? `, ${customer.name}` : ''}</h1>
        <p className="text-slate-400 text-sm mt-1">Here's your salon overview</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4 text-center">
          <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center mx-auto mb-2">
            <Calendar className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white">{upcomingCount}</div>
          <div className="text-xs text-slate-400 mt-0.5">Upcoming</div>
        </div>

        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4 text-center">
          <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center mx-auto mb-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">{totalCount}</div>
          <div className="text-xs text-slate-400 mt-0.5">Total</div>
        </div>

        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4 text-center">
          <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center mx-auto mb-2">
            <Star className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white">{points}</div>
          <div className="text-xs text-slate-400 mt-0.5">Points</div>
        </div>
      </div>

      {appointments.length === 0 && (
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 text-center">
          <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-white font-semibold mb-1">No appointments yet</h3>
          <p className="text-slate-400 text-sm">Book your first appointment today!</p>
        </div>
      )}
    </div>
  );
}
