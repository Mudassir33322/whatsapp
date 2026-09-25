import React, { useEffect, useState } from 'react';
import { useCustomerAuth } from './CustomerAuthContext';
import { Calendar, Loader2, XCircle, RefreshCw } from 'lucide-react';
import { useConfirm } from '../hooks/useConfirm';
import { EmptyState } from '../components/EmptyState';

interface Appointment {
  id: number;
  salon_name?: string;
  service_name?: string;
  appointment_date?: string;
  appointment_time?: string;
  date?: string;
  time?: string;
  status: string;
  recurring_booking_id?: number;
  frequency?: string;
}

const statusColors: Record<string, string> = {
  confirmed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  scheduled: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  completed: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  cancelled: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  pending: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
};

export function CustomerAppointments() {
  const { customerFetch } = useCustomerAuth();
  const { confirm, confirmDialog } = useConfirm();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<number | null>(null);

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

  const cancelAppt = async (id: number) => {
    const confirmed = await confirm('Cancel Appointment', 'Are you sure you want to cancel this appointment?', 'Cancel', 'danger');
    if (!confirmed) return;
    setCancelling(id);
    try {
      const res = await customerFetch(`/api/customer/appointments/${id}/cancel`, { method: 'PUT' });
      if (res.ok) setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'cancelled' } : a));
    } catch (err) {
      console.error('[CustomerAppointments] Failed to cancel appointment:', err);
    }
    finally { setCancelling(null); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8">
        <EmptyState icon={Calendar} title="No appointments yet" description="Your appointments will appear here" />
      </div>
    );
  }

  return (
    <>
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">My Appointments</h1>

      {appointments.map(apt => {
        const canCancel = ['pending', 'confirmed'].includes(apt.status);
        return (
          <div key={apt.id} className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold">{apt.service_name || 'Service'}</h3>
              <div className="flex items-center gap-1.5">
                <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${statusColors[apt.status] || 'bg-slate-500/20 text-slate-300 border-slate-500/30'}`}>
                  {apt.status}
                </span>
                {apt.recurring_booking_id && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30 flex items-center gap-0.5">
                    <RefreshCw className="w-2.5 h-2.5" />
                    {apt.frequency || 'Recurring'}
                  </span>
                )}
              </div>
            </div>
            <p className="text-slate-400 text-sm">{apt.salon_name || 'Salon'}</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm text-slate-300">
                <span>{apt.appointment_date || apt.date || 'Date TBD'}</span>
                {(apt.appointment_time || apt.time) && <span>{apt.appointment_time || apt.time}</span>}
              </div>
              {canCancel && (
                <button type="button" onClick={() => cancelAppt(apt.id)} disabled={cancelling === apt.id}
                  className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-50">
                  {cancelling === apt.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                  Cancel
                </button>
              )}
            </div>
          </div>
        );
        })}
    </div>
    {confirmDialog}
    </>
  );
  }
