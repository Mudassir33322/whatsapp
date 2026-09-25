import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, CheckCircle, Play, XCircle, Loader2, PhoneCall, Scissors, User, Clock, Filter, ChevronLeft, ChevronRight, Sparkles, Plus, Trash2, Receipt, Pencil, RefreshCw } from 'lucide-react';
import { salonFetch } from './api';
import { Pagination } from '../components/Pagination';
import { EmptyState } from '../components/EmptyState';
import { useConfirm } from '../hooks/useConfirm';

interface Appointment {
  id: number;
  appointment_time: string;
  end_time: string;
  customer_name: string;
  customer_phone?: string;
  barber_id?: number;
  barber_name?: string;
  service_id?: number;
  service_name?: string;
  token?: string;
  status: string;
  recurring_booking_id?: number;
  frequency?: string;
}

interface Barber { id: number; name: string; }
interface Service { id: number; name: string; price: number; duration: number; }

const STATUS_OPTIONS = ['all', 'confirmed', 'in_progress', 'completed', 'cancelled', 'pending', 'no_show'];

const STATUS_STYLES: Record<string, { bg: string; dot: string }> = {
  pending: { bg: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  confirmed: { bg: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  in_progress: { bg: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  completed: { bg: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  cancelled: { bg: 'bg-rose-100 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
  no_show: { bg: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
};

const getToday = () => new Date().toISOString().split('T')[0];

export function SalonAppointments() {
  const { confirm, confirmDialog } = useConfirm();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [date, setDate] = useState(getToday());
  const [barberId, setBarberId] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ customer_name: '', customer_phone: '', service_id: '', barber_id: '', appointment_time: '' });
  const [saving, setSaving] = useState(false);
  const [editAppt, setEditAppt] = useState<Appointment | null>(null);
  const [editForm, setEditForm] = useState({ customer_name: '', customer_phone: '', service_id: '', barber_id: '', appointment_time: '' });
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const toDate = (t: string) => new Date(t.includes('T') ? t : `1970-01-01T${t}`);

  const fetchAppointments = async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ date });
      if (barberId) params.set('barber_id', barberId);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const r = await salonFetch(`/api/salon/appointments?${params}`, { signal });
      if (!r.ok) throw new Error('Failed to fetch appointments');
      setAppointments(await r.json());
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setError(e.message);
    }
    finally { setLoading(false); }
  };

  const fetchBarbers = async (signal?: AbortSignal) => {
    try {
      const r = await salonFetch('/api/salon/barbers', { signal });
      if (r.ok) setBarbers(await r.json());
    } catch {}
  };

  const fetchServices = async (signal?: AbortSignal) => {
    try {
      const r = await salonFetch('/api/salon/services', { signal });
      if (r.ok) setServices(await r.json());
    } catch {}
  };

  useEffect(() => {
    const ac = new AbortController();
    fetchBarbers(ac.signal);
    fetchServices(ac.signal);
    return () => ac.abort();
  }, []);
  useEffect(() => {
    const ac = new AbortController();
    fetchAppointments(ac.signal);
    return () => ac.abort();
  }, [date, barberId, statusFilter]);

  useEffect(() => { setPage(1); }, [date, barberId, statusFilter]);

  const paginatedAppointments = useMemo(() =>
    appointments.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE),
    [appointments, page]
  );

  const updateStatus = async (id: number, status: string) => {
    setActionLoading(id);
    try {
      const r = await salonFetch(`/api/salon/appointments/${id}/status`, {
        method: 'PUT', body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error('Failed to update status');
      setAppointments((p) => p.map((a) => a.id === id ? { ...a, status } : a));
    } catch (e: any) { setError(e.message); }
    finally { setActionLoading(null); }
  };

  const deleteAppointment = async (id: number) => {
    const confirmed = await confirm('Delete Appointment', 'Are you sure you want to delete this appointment? This action cannot be undone.', 'Delete', 'danger');
    if (!confirmed) return;
    try {
      const r = await salonFetch(`/api/salon/appointments/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Failed to delete');
      setAppointments((p) => p.filter((a) => a.id !== id));
    } catch (e: any) { setError(e.message); }
  };

  const downloadInvoice = async (id: number) => {
    try {
      const r = await salonFetch(`/api/export/appointments/${id}/invoice`);
      if (!r.ok) { setError('Invoice generate nahi ho saka'); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { setError('Download failed'); }
  };

  const createAppointment = async () => {
    if (!form.customer_name || !form.customer_phone || !form.service_id || !form.appointment_time) {
      setError('Please fill all required fields');
      return;
    }
    setSaving(true);
    setError('');
    const ac = new AbortController();
    try {
      const r = await salonFetch('/api/salon/walkin', {
        method: 'POST',
        body: JSON.stringify({
          phone: form.customer_phone,
          name: form.customer_name,
          service_id: Number(form.service_id),
          barber_id: form.barber_id ? Number(form.barber_id) : null,
          appointment_date: date,
          appointment_time: form.appointment_time,
        }),
      });
      if (!r.ok) throw new Error('Failed to create appointment');
      setShowModal(false);
      setForm({ customer_name: '', customer_phone: '', service_id: '', barber_id: '', appointment_time: '' });
      fetchAppointments(ac.signal);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const openEdit = (a: Appointment) => {
    setEditAppt(a);
    setEditForm({
      customer_name: a.customer_name || '',
      customer_phone: a.customer_phone || '',
      service_id: String(a.service_id || ''),
      barber_id: String(a.barber_id || ''),
      appointment_time: a.appointment_time?.split('T')[1]?.slice(0, 5) || '',
    });
  };

  const saveEdit = async () => {
    if (!editAppt) return;
    if (!editForm.customer_name || !editForm.customer_phone || !editForm.service_id || !editForm.appointment_time) {
      setError('Please fill all required fields');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const r = await salonFetch(`/api/salon/appointments/${editAppt.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          customer_name: editForm.customer_name,
          customer_phone: editForm.customer_phone,
          service_id: Number(editForm.service_id),
          barber_id: editForm.barber_id ? Number(editForm.barber_id) : null,
          appointment_time: editForm.appointment_time,
        }),
      });
      if (!r.ok) throw new Error('Failed to update appointment');
      setEditAppt(null);
      const editAc = new AbortController();
      fetchAppointments(editAc.signal);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const stats = useMemo(() => ({
    total: appointments.length,
    completed: appointments.filter(a => a.status === 'completed').length,
    inProgress: appointments.filter(a => a.status === 'in_progress').length,
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
  }), [appointments]);

  const changeDate = (days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Loading appointments...</p>
      </div>
    </div>
  );
  if (error && !appointments.length) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-rose-50 text-rose-700 px-6 py-4 rounded-2xl border border-rose-200 text-sm font-medium shadow-sm">{error}</div>
    </div>
  );

  const fmtStatus = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (<>
      {confirmDialog}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-amber-500" />
            Appointments
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage today's bookings & appointments</p>
        </div>
        <button type="button" onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg hover:shadow-amber-200/50 transition-all text-sm font-semibold">
          <Plus className="w-4 h-4" />
          New Appointment
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 text-rose-700 px-4 py-3 rounded-2xl border border-rose-200 text-sm shadow-sm">{error}</div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'from-amber-500 to-orange-500' },
          { label: 'Confirmed', value: stats.confirmed, color: 'from-blue-500 to-amber-500' },
          { label: 'In Progress', value: stats.inProgress, color: 'from-amber-500 to-orange-500' },
          { label: 'Completed', value: stats.completed, color: 'from-emerald-500 to-green-500' },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white/80 backdrop-blur rounded-xl border border-amber-100/50 p-4"
          >
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">{s.label}</p>
            <p className="text-xl font-bold text-slate-800 mt-0.5">{s.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-white/80 rounded-xl border border-amber-100/50 p-1">
          <button type="button" onClick={() => changeDate(-1)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="pl-9 pr-3 py-2 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-transparent text-slate-700" />
          </div>
          <button type="button" onClick={() => changeDate(1)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select value={barberId} onChange={(e) => setBarberId(e.target.value)}
            className="pl-9 pr-8 py-2.5 bg-white/80 border border-amber-100/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 text-slate-700 appearance-none cursor-pointer">
            <option value="">All Barbers</option>
            {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-9 pr-8 py-2.5 bg-white/80 border border-amber-100/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 text-slate-700 appearance-none cursor-pointer">
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s === 'all' ? 'All Status' : fmtStatus(s)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2.5">
        {!appointments.length ? (
          <div className="bg-white/60 rounded-2xl border border-amber-100/50">
            <EmptyState icon={Calendar} title="No appointments for this date" description="Try a different date or filter" />
          </div>
        ) : paginatedAppointments.map((a, i) => {
          const st = STATUS_STYLES[a.status] || STATUS_STYLES.pending;
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-white/80 backdrop-blur rounded-2xl border border-amber-100/50 p-4 hover:shadow-lg hover:shadow-amber-100/50 transition-all duration-300"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex flex-col items-center min-w-[60px]">
                    <span className="text-lg font-bold text-slate-800 leading-tight">
                      {a.appointment_time ? toDate(a.appointment_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}
                    </span>
                    {a.end_time && (
                      <span className="text-[10px] text-slate-400">
                        → {toDate(a.end_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-800">{a.customer_name}</p>
                      {a.token && (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 text-white text-[10px] font-bold shadow-sm">
                          {a.token}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                      {a.barber_name && (
                        <span className="flex items-center gap-1">
                          <Scissors className="w-3 h-3 text-amber-400" />
                          {a.barber_name}
                        </span>
                      )}
                      {a.service_name && (
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          {a.service_name}
                        </span>
                      )}
                    </div>
                  </div>

                   <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${st.bg}`}>
                     <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                     {fmtStatus(a.status)}
                   </span>
                   {a.recurring_booking_id && (
                     <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-700 border border-violet-200">
                       <RefreshCw className="w-3 h-3" />
                       {a.frequency || 'Recurring'}
                     </span>
                   )}
                 </div>

                <div className="flex items-center gap-1 ml-4 shrink-0">
                  <motion.button type="button" onClick={() => downloadInvoice(a.id)} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all" title="Download Invoice">
                    <Receipt className="w-4 h-4" />
                  </motion.button>
                  {a.customer_phone && (
                    <motion.a href={`https://wa.me/${a.customer_phone}`} target="_blank" rel="noopener noreferrer" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all" title="WhatsApp">
                      <PhoneCall className="w-4 h-4" />
                    </motion.a>
                  )}
                  {a.status === 'pending' && (
                    <motion.button type="button" onClick={() => updateStatus(a.id, 'confirmed')} disabled={actionLoading === a.id} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all" title="Confirm">
                      <CheckCircle className="w-4 h-4" />
                    </motion.button>
                  )}
                  {a.status === 'confirmed' && (
                    <motion.button type="button" onClick={() => updateStatus(a.id, 'in_progress')} disabled={actionLoading === a.id} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all" title="Start">
                      <Play className="w-4 h-4" />
                    </motion.button>
                  )}
                  {a.status === 'in_progress' && (
                    <motion.button type="button" onClick={() => updateStatus(a.id, 'completed')} disabled={actionLoading === a.id} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all" title="Complete">
                      <CheckCircle className="w-4 h-4" />
                    </motion.button>
                  )}
                  {!['cancelled', 'no_show', 'completed'].includes(a.status) && (
                    <motion.button type="button" onClick={() => updateStatus(a.id, 'cancelled')} disabled={actionLoading === a.id} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all" title="Cancel">
                      <XCircle className="w-4 h-4" />
                    </motion.button>
                  )}
                  <motion.button type="button" onClick={() => openEdit(a)} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all" title="Edit">
                    <Pencil className="w-4 h-4" />
                  </motion.button>
                  <motion.button type="button" onClick={() => deleteAppointment(a.id)} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <Pagination page={page} totalPages={Math.ceil(appointments.length / ITEMS_PER_PAGE)} onPageChange={setPage} />

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setShowModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg border border-amber-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-slate-800">New Appointment</h2>
                <button type="button" onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><XCircle className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Customer Name *</label>
                  <input type="text" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                    className="w-full px-4 py-2.5 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" placeholder="Enter customer name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Customer Phone *</label>
                  <input type="text" value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                    className="w-full px-4 py-2.5 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" placeholder="e.g. 923001234567" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Service *</label>
                    <select value={form.service_id} onChange={(e) => setForm({ ...form, service_id: e.target.value })}
                      className="w-full px-4 py-2.5 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300">
                      <option value="">Select service</option>
                      {services.map((s) => <option key={s.id} value={s.id}>{s.name} (Rs.{s.price})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Barber</label>
                    <select value={form.barber_id} onChange={(e) => setForm({ ...form, barber_id: e.target.value })}
                      className="w-full px-4 py-2.5 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300">
                      <option value="">Auto-assign</option>
                      {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Time *</label>
                  <input type="time" value={form.appointment_time} onChange={(e) => setForm({ ...form, appointment_time: e.target.value })}
                    className="w-full px-4 py-2.5 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
                <p className="text-xs text-slate-400">Date: {new Date(date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-amber-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-amber-50 transition-all">Cancel</button>
                <button type="button" onClick={createAppointment} disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-amber-200/50 transition-all disabled:opacity-50">
                  {saving ? 'Creating...' : 'Create Appointment'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {editAppt && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setEditAppt(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg border border-amber-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-slate-800">Edit Appointment</h2>
                <button type="button" onClick={() => setEditAppt(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><XCircle className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Customer Name *</label>
                  <input type="text" value={editForm.customer_name} onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })}
                    className="w-full px-4 py-2.5 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" placeholder="Enter customer name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Customer Phone *</label>
                  <input type="text" value={editForm.customer_phone} onChange={(e) => setEditForm({ ...editForm, customer_phone: e.target.value })}
                    className="w-full px-4 py-2.5 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" placeholder="e.g. 923001234567" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Service *</label>
                    <select value={editForm.service_id} onChange={(e) => setEditForm({ ...editForm, service_id: e.target.value })}
                      className="w-full px-4 py-2.5 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300">
                      <option value="">Select service</option>
                      {services.map((s) => <option key={s.id} value={s.id}>{s.name} (Rs.{s.price})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Barber</label>
                    <select value={editForm.barber_id} onChange={(e) => setEditForm({ ...editForm, barber_id: e.target.value })}
                      className="w-full px-4 py-2.5 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300">
                      <option value="">Auto-assign</option>
                      {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Time *</label>
                  <input type="time" value={editForm.appointment_time} onChange={(e) => setEditForm({ ...editForm, appointment_time: e.target.value })}
                    className="w-full px-4 py-2.5 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
                <p className="text-xs text-slate-400">Date: {new Date(date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setEditAppt(null)}
                  className="flex-1 px-4 py-2.5 border border-amber-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-amber-50 transition-all">Cancel</button>
                <button type="button" onClick={saveEdit} disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-amber-200/50 transition-all disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
