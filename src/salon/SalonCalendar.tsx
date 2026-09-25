import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2, User, Scissors, Store, Clock, CheckCircle, XCircle, Plus } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { salonFetch } from './api';
import { useConfirm } from '../hooks/useConfirm';
import { Pagination } from '../components/Pagination';

export function SalonCalendar() {
  const { confirm, confirmDialog } = useConfirm();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const [barbers, setBarbers] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ customer_name: '', customer_phone: '', service_id: '', barber_id: '', appointment_time: '' });
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const updateStatus = useCallback(async (id: number, status: string) => {
    setUpdatingId(id);
    try {
      await salonFetch(`/api/salon/appointments/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    } catch {} finally { setUpdatingId(null); }
  }, []);

  const deleteAppt = useCallback(async (id: number) => {
    const confirmed = await confirm('Delete Appointment', 'Are you sure you want to delete this appointment? This action cannot be undone.', 'Delete', 'danger');
    if (!confirmed) return;
    try {
      await salonFetch(`/api/salon/appointments/${id}`, { method: 'DELETE' });
      setAppointments(prev => prev.filter(a => a.id !== id));
    } catch {}
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const [sRes, bRes] = await Promise.all([
          salonFetch('/api/salon/services', { signal: ac.signal }),
          salonFetch('/api/salon/barbers', { signal: ac.signal }),
        ]);
        if (sRes.ok) setServices(await sRes.json());
        if (bRes.ok) setBarbers(await bRes.json());
      } catch (err) {
        if ((err as any)?.name === 'AbortError') return;
      }
    })();
    return () => ac.abort();
  }, []);

  useEffect(() => { setPage(1); }, [selectedDate]);

  const createAppt = async () => {
    if (!createForm.customer_name || !createForm.customer_phone || !createForm.service_id || !createForm.appointment_time || !selectedDate) return;
    setCreating(true);
    try {
      const r = await salonFetch('/api/salon/walkin', {
        method: 'POST',
        body: JSON.stringify({
          phone: createForm.customer_phone,
          name: createForm.customer_name,
          service_id: Number(createForm.service_id),
          barber_id: createForm.barber_id ? Number(createForm.barber_id) : null,
          appointment_date: format(selectedDate, 'yyyy-MM-dd'),
          appointment_time: createForm.appointment_time,
        }),
      });
      if (r.ok) {
        setShowCreateModal(false);
        setCreateForm({ customer_name: '', customer_phone: '', service_id: '', barber_id: '', appointment_time: '' });
        const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
        const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
        const res = await salonFetch(`/api/salon/appointments?date_from=${start}&date_to=${end}`);
        if (res.ok) setAppointments(await res.json());
      }
    } catch {} finally { setCreating(false); }
  };

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
        const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
        const res = await salonFetch(`/api/salon/appointments?date_from=${start}&date_to=${end}`, { signal: ac.signal });
        if (res.ok) setAppointments(await res.json());
      } catch {} finally { setLoading(false); }
    })();
    return () => ac.abort();
  }, [currentMonth]);

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const startDay = getDay(startOfMonth(currentMonth));

  const dayAppts = (date: Date) => appointments.filter(a => isSameDay(new Date(a.appointment_date), date));

  const statusDot = (st: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-amber-400',
      confirmed: 'bg-blue-400',
      in_progress: 'bg-violet-400',
      completed: 'bg-emerald-400',
      cancelled: 'bg-rose-400',
      no_show: 'bg-slate-400',
    };
    return colors[st] || 'bg-slate-400';
  };

  const selectedDayAppts = selectedDate ? dayAppts(selectedDate) : [];
  const paginatedDayAppts = useMemo(() =>
    selectedDayAppts.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE),
    [selectedDayAppts, page]
  );

  return (
    <div>
      {confirmDialog}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-amber-500" />
            Calendar
          </h1>
          <p className="text-sm text-slate-500 mt-1">Appointments overview by date</p>
        </div>
        <button type="button"
          onClick={() => { setCurrentMonth(new Date()); setSelectedDate(new Date()); }}
          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-amber-200"
        >
          Today
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white/80 backdrop-blur rounded-2xl border border-amber-100/50 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <button type="button" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-amber-50 rounded-xl transition-colors text-slate-400 hover:text-amber-600">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold text-slate-800">{format(currentMonth, 'MMMM yyyy')}</h2>
            <button type="button" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-amber-50 rounded-xl transition-colors text-slate-400 hover:text-amber-600">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-xs font-semibold text-slate-500 uppercase py-2">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {Array.from({ length: startDay }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[80px] p-1" />
            ))}
            {days.map((date, i) => {
              const dayAppt = dayAppts(date);
              const isToday = isSameDay(date, new Date());
              const isSelected = selectedDate && isSameDay(date, selectedDate);
              return (
                <motion.button
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.005 }}
                  onClick={() => setSelectedDate(date)}
                  className={`min-h-[80px] p-1.5 border border-amber-100/50 rounded-lg text-left transition-all hover:bg-amber-50/50 ${
                    isSelected ? 'ring-2 ring-amber-500 bg-amber-50' : ''
                  } ${isToday ? 'bg-amber-50/70' : ''}`}
                >
                  <span className={`text-xs font-semibold ${isToday ? 'text-amber-600' : 'text-slate-500'}`}>
                    {format(date, 'd')}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {dayAppt.slice(0, 3).map((a: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot(a.status)}`} />
                        <span className="text-[9px] text-slate-500 truncate leading-tight">{a.customer_name || a.customer_phone}</span>
                      </div>
                    ))}
                    {dayAppt.length > 3 && (
                      <span className="text-[9px] text-amber-600 font-medium">+{dayAppt.length - 3} more</span>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur rounded-2xl border border-amber-100/50 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : 'Select a date'}
            </h2>
            {selectedDate && (
              <button type="button" onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-semibold rounded-xl transition-all shadow-sm">
                <Plus className="w-3.5 h-3.5" /> New
              </button>
            )}
          </div>
          {!selectedDate ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <CalendarIcon className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">Click a date to view appointments</p>
            </div>
          ) : loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {selectedDayAppts.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No appointments on this date</p>
              ) : (
                paginatedDayAppts.map((a: any, i: number) => (
                  <motion.div
                    key={a.id || i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-amber-50/50 rounded-xl p-4 border border-amber-100/70"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {a.customer_name || a.customer_phone}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        a.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                        a.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                        a.status === 'cancelled' ? 'bg-rose-100 text-rose-700' :
                        a.status === 'in_progress' ? 'bg-violet-100 text-violet-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {a.status?.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Scissors className="w-3 h-3" />{a.service_name}</span>
                      <span className="flex items-center gap-1"><User className="w-3 h-3" />{a.barber_name}</span>
                    </div>
                    {a.appointment_time && (
                      <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />{a.appointment_time} - {a.end_time}
                      </p>
                    )}
                    <div className="flex items-center gap-1 mt-2 pt-2 border-t border-amber-100">
                      <button type="button"
                        onClick={(e) => { e.stopPropagation(); updateStatus(a.id, 'completed'); }}
                        disabled={updatingId === a.id}
                        className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600 hover:bg-emerald-200 transition-colors disabled:opacity-40"
                        title="Mark completed"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                      </button>
                      <button type="button"
                        onClick={(e) => { e.stopPropagation(); updateStatus(a.id, 'cancelled'); }}
                        disabled={updatingId === a.id}
                        className="p-1.5 rounded-lg bg-rose-100 text-rose-600 hover:bg-rose-200 transition-colors disabled:opacity-40"
                        title="Cancel"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                      <button type="button"
                        onClick={(e) => { e.stopPropagation(); deleteAppt(a.id); }}
                        className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors ml-auto"
                        title="Delete"
                      >
                        <XCircle className="w-3 h-3" />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
              <Pagination page={page} totalPages={Math.ceil(selectedDayAppts.length / ITEMS_PER_PAGE)} onPageChange={setPage} />
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowCreateModal(false)}>
          <div onClick={(e) => e.stopPropagation()}
            className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl p-6 w-full max-w-lg border border-amber-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-800">New Appointment</h2>
              <button type="button" onClick={() => setShowCreateModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-amber-50"><XCircle className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Customer Name *</label>
                <input type="text" value={createForm.customer_name} onChange={(e) => setCreateForm({ ...createForm, customer_name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-amber-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white/50 placeholder-slate-400" placeholder="Enter customer name" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Customer Phone *</label>
                <input type="text" value={createForm.customer_phone} onChange={(e) => setCreateForm({ ...createForm, customer_phone: e.target.value })}
                  className="w-full px-4 py-2.5 border border-amber-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white/50 placeholder-slate-400" placeholder="e.g. 923001234567" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Service *</label>
                  <select value={createForm.service_id} onChange={(e) => setCreateForm({ ...createForm, service_id: e.target.value })}
                    className="w-full px-4 py-2.5 border border-amber-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white/50">
                    <option value="">Select service</option>
                    {services.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Barber</label>
                  <select value={createForm.barber_id} onChange={(e) => setCreateForm({ ...createForm, barber_id: e.target.value })}
                    className="w-full px-4 py-2.5 border border-amber-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white/50">
                    <option value="">Auto-assign</option>
                    {barbers.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Time *</label>
                <input type="time" value={createForm.appointment_time} onChange={(e) => setCreateForm({ ...createForm, appointment_time: e.target.value })}
                  className="w-full px-4 py-2.5 border border-amber-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white/50" />
              </div>
              {selectedDate && (
                <p className="text-xs text-slate-500">Date: {format(selectedDate, 'EEEE, MMMM d, yyyy')}</p>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2.5 border border-amber-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-amber-50 transition-all">Cancel</button>
              <button type="button" onClick={createAppt} disabled={creating}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-semibold hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 shadow-lg shadow-amber-200">
                {creating ? 'Creating...' : 'Create Appointment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
