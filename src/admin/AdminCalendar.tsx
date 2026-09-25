import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion } from 'motion/react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown, Loader2, User, Scissors, Store, Clock, CheckCircle, XCircle, Plus, X, Edit3 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { useAdminAuth } from './AdminAuthContext';
import SalonLocationFilter from './SalonLocationFilter';
import { Pagination } from '../components/Pagination';
import { useConfirm } from '../hooks/useConfirm';

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  confirmed: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  in_progress: { bg: 'bg-violet-500/20', text: 'text-violet-400' },
  completed: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  cancelled: { bg: 'bg-rose-500/20', text: 'text-rose-400' },
  no_show: { bg: 'bg-slate-500/20', text: 'text-slate-400' },
};

type SearchSelectProps = {
  label: string;
  required?: boolean;
  items: { id: number; name: string }[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
  error?: string;
  onClearError?: () => void;
};

function SearchSelect({ label, required, items, value, onChange, placeholder, disabled, error, onClearError }: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = items.find(i => i.id === +value);

  return (
    <div ref={ref}>
      <label className="block text-sm font-medium text-slate-300 mb-1">{label}{required ? ' *' : ''}</label>
      <div className="relative">
        <div onClick={() => { if (!disabled) { setOpen(!open); setSearch(''); } }} className={`w-full px-4 py-2.5 bg-slate-700 border rounded-xl text-sm text-white cursor-pointer flex items-center justify-between ${error ? 'border-rose-500' : 'border-slate-600'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
          <span className={value && selected ? 'text-white' : 'text-slate-400'}>{selected ? selected.name : placeholder}</span>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </div>
        {open && (
          <div className="absolute z-50 mt-1 w-full bg-slate-700 border border-slate-600 rounded-xl shadow-xl max-h-56 overflow-y-auto">
            <div className="sticky top-0 bg-slate-700 p-1.5 border-b border-slate-600">
              <input autoFocus placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="w-full px-3 py-1.5 bg-slate-600 rounded-lg text-sm text-white placeholder-slate-400 outline-none" />
            </div>
            {items.filter(i => i.name.toLowerCase().includes(search.toLowerCase())).map(i => (
              <div key={i.id} onClick={() => { onChange(String(i.id)); onClearError?.(); setOpen(false); }} className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-indigo-500/20 ${value === String(i.id) ? 'bg-indigo-500/30 text-indigo-300' : 'text-slate-200'}`}>{i.name}</div>
            ))}
            {items.filter(i => i.name.toLowerCase().includes(search.toLowerCase())).length === 0 && <div className="px-4 py-3 text-sm text-slate-400">No results</div>}
          </div>
        )}
      </div>
      {error && <p className="text-rose-400 text-xs mt-1">{error}</p>}
    </div>
  );
}

export function AdminCalendar() {
  const { adminFetch } = useAdminAuth();
  const { confirm, confirmDialog } = useConfirm();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ salon_id: '', customer_name: '', customer_phone: '', service_id: '', barber_id: '', appointment_time: '' });
  const [salons, setSalons] = useState<any[]>([]);
  const [salonFilter, setSalonFilter] = useState('');
  const [barbers, setBarbers] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const updateStatus = useCallback(async (id: number, status: string) => {
    setUpdatingId(id);
    try {
      await adminFetch(`/api/admin/appointments/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    } catch (err) {
      console.error('[AdminCalendar] Failed to update status:', err);
    } finally { setUpdatingId(null); }
  }, [adminFetch]);

  const deleteAppt = useCallback(async (id: number) => {
    const confirmed = await confirm('Delete Appointment', 'Are you sure you want to delete this appointment?', 'Delete', 'danger');
    if (!confirmed) return;
    try {
      await adminFetch(`/api/admin/appointments/${id}`, { method: 'DELETE' });
      setAppointments(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error('[AdminCalendar] Failed to delete appointment:', err);
    }
  }, [adminFetch]);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
        const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
        let url = `/api/admin/appointments?date_from=${start}&date_to=${end}`;
        if (salonFilter) url += `&salon_id=${salonFilter}`;
        const res = await adminFetch(url, { signal: ac.signal });
        if (res.ok) setAppointments(await res.json());
      } catch (err) {
        console.error('[AdminCalendar] Failed to load appointments:', err);
      } finally { setLoading(false); }
    })();
    return () => ac.abort();
  }, [currentMonth, salonFilter]);

  useEffect(() => {
    const ac = new AbortController();
    if (!form.salon_id) { setBarbers([]); setServices([]); return () => ac.abort(); }
    adminFetch(`/api/admin/staff?salonId=${form.salon_id}`, { signal: ac.signal }).then(r => r.ok ? r.json() : []).then(setBarbers).catch(() => setBarbers([]));
    adminFetch(`/api/admin/services?salon_id=${form.salon_id}`, { signal: ac.signal }).then(r => r.ok ? r.json() : []).then(setServices).catch(() => setServices([]));
    setForm(f => ({ ...f, barber_id: '', service_id: '' }));
    return () => ac.abort();
  }, [form.salon_id]);

  useEffect(() => { setPage(1); }, [selectedDate]);

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
  };

  const handleCreateBooking = () => {
    if (!selectedDate) return;
    setEditing(null);
    setFormErrors({});
    setForm({
      salon_id: '', customer_name: '', customer_phone: '',
      service_id: '', barber_id: '',
      appointment_time: ''
    });
    setBarbers([]);
    setServices([]);
    setShowModal(true);
  };

  const handleEditBooking = (apt: any) => {
    setEditing(apt);
    setFormErrors({});
    setForm({
      salon_id: String(apt.salon_id || ''),
      customer_name: apt.customer_name || '',
      customer_phone: apt.customer_phone || '',
      service_id: String(apt.service_id || ''),
      barber_id: String(apt.barber_id || ''),
      appointment_time: apt.appointment_time || ''
    });
    setShowModal(true);
  };

  const saveBooking = async () => {
    if (!selectedDate) return;
    const errs: Record<string, string> = {};
    if (!form.salon_id) errs.salon_id = 'Salon is required';
    if (!form.customer_phone.trim()) errs.customer_phone = 'Phone is required';
    if (!form.service_id) errs.service_id = 'Service is required';
    if (!form.appointment_time) errs.appointment_time = 'Time is required';
    setFormErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const body = {
        ...form,
        salon_id: Number(form.salon_id),
        service_id: Number(form.service_id),
        barber_id: form.barber_id ? Number(form.barber_id) : null,
        appointment_date: format(selectedDate, 'yyyy-MM-dd'),
        status: 'confirmed',
      };
      const isEdit = !!editing;
      const url = isEdit ? `/api/admin/appointments/${editing.id}` : '/api/admin/appointments';
      const res = await adminFetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed');
      setEditing(null);
      setFormErrors({});
      setShowModal(false);
      const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      const r = await adminFetch(`/api/admin/appointments?date_from=${start}&date_to=${end}`);
      if (r.ok) setAppointments(await r.json());
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const startDay = getDay(startOfMonth(currentMonth));

  const dayAppts = (date: Date) => appointments.filter(a => a.appointment_date && isSameDay(new Date(a.appointment_date), date));

  const statusDot = (st: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-amber-400', confirmed: 'bg-blue-400', in_progress: 'bg-violet-400',
      completed: 'bg-emerald-400', cancelled: 'bg-rose-400', no_show: 'bg-slate-400',
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
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-indigo-400" /> Calendar
          </h1>
          <p className="text-sm text-slate-400 mt-1">Appointments overview by date</p>
        </div>
        <div className="flex items-center gap-3">
          <SalonLocationFilter salonFilter={salonFilter} setSalonFilter={setSalonFilter} salons={salons} setSalons={setSalons} adminFetch={adminFetch} />
          <button type="button" onClick={() => { setCurrentMonth(new Date()); setSelectedDate(new Date()); }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all">Today</button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700/50 p-6">
          <div className="flex items-center justify-between mb-6">
            <button type="button" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-slate-700 rounded-xl transition-colors text-slate-400 hover:text-white">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold text-white">{format(currentMonth, 'MMMM yyyy')}</h2>
            <button type="button" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-slate-700 rounded-xl transition-colors text-slate-400 hover:text-white">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-xs font-semibold text-slate-500 uppercase py-2">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {Array.from({ length: startDay }).map((_, i) => (<div key={`empty-${i}`} className="min-h-[80px] p-1" />))}
            {days.map((date, i) => {
              const dayAppt = dayAppts(date);
              const isToday = isSameDay(date, new Date());
              const isSelected = selectedDate && isSameDay(date, selectedDate);
              return (
                <motion.button key={format(date, 'yyyy-MM-dd')} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.005 }}
                  onClick={() => handleDateClick(date)}
                  className={`min-h-[80px] p-1.5 border border-slate-700/30 rounded-lg text-left transition-all hover:bg-slate-700/30 ${
                    isSelected ? 'ring-2 ring-indigo-500 bg-slate-700/40' : ''
                  } ${isToday ? 'bg-indigo-500/10' : ''}`}>
                  <span className={`text-xs font-semibold ${isToday ? 'text-indigo-400' : 'text-slate-400'}`}>{format(date, 'd')}</span>
                  <div className="mt-1 space-y-0.5">
                    {dayAppt.slice(0, 3).map((a: any) => (
                      <div key={a.id || `${a.appointment_time}-${a.customer_phone}`} className="flex items-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot(a.status)}`} />
                        <span className="text-[9px] text-slate-300 truncate leading-tight">{a.customer_name || a.customer_phone}</span>
                      </div>
                    ))}
                    {dayAppt.length > 3 && <span className="text-[9px] text-indigo-400 font-medium">+{dayAppt.length - 3} more</span>}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : 'Select a date'}
            </h2>
            {selectedDate && (
              <button type="button" onClick={handleCreateBooking}
                className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all" title="New Booking">
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
          {!selectedDate ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <CalendarIcon className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">Click a date to view appointments</p>
            </div>
          ) : loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {selectedDayAppts.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No appointments on this date</p>
              ) : (
                paginatedDayAppts.map((a: any, i: number) => (
                  <motion.div key={a.id || i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-white flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" /> {a.customer_name || a.customer_phone}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[a.status]?.bg || 'bg-slate-500/20'} ${STATUS_STYLES[a.status]?.text || 'text-slate-400'}`}>
                        {a.status?.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><Scissors className="w-3 h-3" />{a.service_name || 'N/A'}</span>
                      <span className="flex items-center gap-1"><User className="w-3 h-3" />{a.barber_name || 'Unassigned'}</span>
                    </div>
                    {a.appointment_time && (
                      <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1"><Clock className="w-3 h-3" />{a.appointment_time} {a.end_time ? `- ${a.end_time}` : ''}</p>
                    )}
                    <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-600/20">
                      <button type="button" onClick={() => handleEditBooking(a)}
                        className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors" title="Edit">
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => updateStatus(a.id, 'completed')} disabled={updatingId === a.id}
                        className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-40" title="Mark completed">
                        <CheckCircle className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => updateStatus(a.id, 'cancelled')} disabled={updatingId === a.id}
                        className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors disabled:opacity-40" title="Cancel">
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => deleteAppt(a.id)}
                        className="p-1.5 rounded-lg bg-slate-500/10 text-slate-400 hover:bg-slate-500/20 transition-colors ml-auto" title="Delete">
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

      {showModal && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => { setShowModal(false); setEditing(null); setFormErrors({}); }}>
          <div onClick={(e) => e.stopPropagation()} className="bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">{editing ? 'Edit' : 'New'} Booking — {format(selectedDate, 'MMM d, yyyy')}</h2>
              <button type="button" onClick={() => { setShowModal(false); setEditing(null); setFormErrors({}); }} className="p-1 text-slate-400 hover:text-white rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Customer Name</label>
                  <input type="text" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Phone *</label>
                  <input type="text" value={form.customer_phone} onChange={(e) => { setForm({ ...form, customer_phone: e.target.value }); setFormErrors(e => ({ ...e, customer_phone: '' })); }}
                    className={`w-full px-4 py-2.5 bg-slate-700 border rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 ${formErrors.customer_phone ? 'border-rose-500' : 'border-slate-600'}`} />
                  {formErrors.customer_phone && <p className="text-rose-400 text-xs mt-1">{formErrors.customer_phone}</p>}
                </div>
              </div>
              <SearchSelect label="Salon" required items={salons} value={form.salon_id} onChange={(v) => { setForm({ ...form, salon_id: v }); setFormErrors(e => ({ ...e, salon_id: '' })); }} placeholder="Select Salon" error={formErrors.salon_id} onClearError={() => setFormErrors(e => ({ ...e, salon_id: '' }))} />
              <div className="grid grid-cols-2 gap-4">
                <SearchSelect label="Service" required items={services} value={form.service_id} onChange={(v) => { setForm({ ...form, service_id: v }); setFormErrors(e => ({ ...e, service_id: '' })); }} placeholder={form.salon_id ? 'Select Service' : 'Select salon first'} disabled={!form.salon_id} error={formErrors.service_id} onClearError={() => setFormErrors(e => ({ ...e, service_id: '' }))} />
                <SearchSelect label="Barber" items={barbers} value={form.barber_id} onChange={(v) => setForm({ ...form, barber_id: v })} placeholder={form.salon_id ? 'Select Barber' : 'Select salon first'} disabled={!form.salon_id} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Time *</label>
                <input type="time" value={form.appointment_time} onChange={(e) => { setForm({ ...form, appointment_time: e.target.value }); setFormErrors(e => ({ ...e, appointment_time: '' })); }}
                  className={`w-full px-4 py-2.5 bg-slate-700 border rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${formErrors.appointment_time ? 'border-rose-500' : 'border-slate-600'}`} />
                {formErrors.appointment_time && <p className="text-rose-400 text-xs mt-1">{formErrors.appointment_time}</p>}
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => { setShowModal(false); setEditing(null); setFormErrors({}); }}
                className="flex-1 px-4 py-2.5 border border-slate-600 text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-700 transition-all">Cancel</button>
              <button type="button" onClick={saveBooking} disabled={saving}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-all disabled:opacity-50">
                {saving ? 'Saving...' : editing ? 'Update Booking' : 'Create Booking'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
