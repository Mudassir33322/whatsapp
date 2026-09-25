import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Search, Loader2, Store, User, Scissors, FileText, Plus, Pencil, Trash2, X, CheckCircle, Play, XCircle, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { useAdminAuth } from './AdminAuthContext';
import { EmptyState } from '../components/EmptyState';
import SalonLocationFilter from './SalonLocationFilter';
import { Pagination } from '../components/Pagination';
import { useConfirm } from '../hooks/useConfirm';

const STATUSES = ['', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];

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

export function AdminAppointments() {
  const { adminFetch } = useAdminAuth();
  const { confirm, confirmDialog } = useConfirm();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ salon_id: '', status: '', date: '' });
  const [salons, setSalons] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [barbers, setBarbers] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ salon_id: '', customer_name: '', customer_phone: '', service_id: '', barber_id: '', appointment_date: '', appointment_time: '', status: 'confirmed' });
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const toggleSelect = (id: number) => setSelectedIds((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const toggleSelectAll = () => setSelectedIds((prev) => (prev.size === paginatedAppointments.length ? new Set() : new Set(paginatedAppointments.map((a: any) => a.id))));
  const clearSelection = () => setSelectedIds(new Set());
  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = await confirm('Delete Selected', `Delete ${selectedIds.size} appointment(s)? This action cannot be undone.`, 'Delete');
    if (!confirmed) return;
    setBulkDeleting(true);
    try {
      await Promise.all([...selectedIds].map((id) => adminFetch(`/api/admin/appointments/${id}`, { method: 'DELETE' })));
      setSelectedIds(new Set());
      fetchAllRef.current();
    } catch (e: any) { console.error('[AdminAppointments] Bulk delete failed:', e); } finally { setBulkDeleting(false); }
  };

  const fetchAllRef = useRef<(signal?: AbortSignal) => Promise<void>>(async () => {});
  fetchAllRef.current = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.salon_id) params.set('salon_id', filter.salon_id);
      if (filter.status) params.set('status', filter.status);
      if (filter.date) params.set('date', filter.date);
      const res = await adminFetch(`/api/admin/appointments?${params}`, { signal });
      if (res.ok) setAppointments(await res.json());
    } catch (err) {
      console.error('[AdminAppointments] Failed to fetch appointments:', err);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const ac = new AbortController();
    fetchAllRef.current?.(ac.signal);
    return () => ac.abort();
  }, [filter]);

  useEffect(() => { setPage(1); }, [filter]);

  const paginatedAppointments = useMemo(() =>
    appointments.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE),
    [appointments, page]
  );

  useEffect(() => {
    const ac = new AbortController();
    adminFetch('/api/admin/salons', { signal: ac.signal }).then(r => r.ok ? r.json() : []).then(setSalons).catch((err) => { console.error('[AdminAppointments] Failed to load salons:', err); });
    return () => ac.abort();
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    if (!form.salon_id) { setBarbers([]); setServices([]); return () => ac.abort(); }
    adminFetch(`/api/admin/staff?salonId=${form.salon_id}`, { signal: ac.signal }).then(r => r.ok ? r.json() : []).then(setBarbers).catch(() => setBarbers([]));
    adminFetch(`/api/admin/services?salon_id=${form.salon_id}`, { signal: ac.signal }).then(r => r.ok ? r.json() : []).then(setServices).catch(() => setServices([]));
    setForm(f => ({ ...f, barber_id: '', service_id: '' }));
    return () => ac.abort();
  }, [form.salon_id]);

  const openCreate = () => {
    setEditing(null);
    setFormErrors({});
    setForm({ salon_id: '', customer_name: '', customer_phone: '', service_id: '', barber_id: '', appointment_date: '', appointment_time: '', status: 'confirmed' });
    setBarbers([]);
    setServices([]);
    setShowModal(true);
  };

  const openEdit = (a: any) => {
    setEditing(a);
    setFormErrors({});
    setForm({
      salon_id: String(a.salon_id),
      customer_name: a.customer_name || '',
      customer_phone: a.customer_phone || '',
      service_id: String(a.service_id),
      barber_id: String(a.barber_id || ''),
      appointment_date: a.appointment_date,
      appointment_time: a.appointment_time,
      status: a.status,
    });
    setShowModal(true);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.salon_id) errs.salon_id = 'Salon is required';
    if (!form.customer_phone.trim()) errs.customer_phone = 'Phone is required';
    if (!form.service_id) errs.service_id = 'Service is required';
    if (!form.appointment_date) errs.appointment_date = 'Date is required';
    if (!form.appointment_time) errs.appointment_time = 'Time is required';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editing) {
        const res = await adminFetch(`/api/admin/appointments/${editing.id}`, {
          method: 'PUT', body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error('Failed to update');
      } else {
        const res = await adminFetch('/api/admin/appointments', {
          method: 'POST', body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error('Failed to create');
      }
      setShowModal(false);
      fetchAllRef.current();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      const res = await adminFetch(`/api/admin/appointments/${id}/status`, {
        method: 'PUT', body: JSON.stringify({ status }),
      });
      if (res.ok) setAppointments((p) => p.map((a) => a.id === id ? { ...a, status } : a));
    } catch (err) {
      console.error('[AdminAppointments] Failed to update status:', err);
    }
  };

  const deleteAppt = async (id: number) => {
    const confirmed = await confirm('Delete Appointment', 'Are you sure you want to delete this appointment?', 'Delete', 'danger');
    if (!confirmed) return;
    try {
      const res = await adminFetch(`/api/admin/appointments/${id}`, { method: 'DELETE' });
      if (res.ok) setAppointments((p) => p.filter((a) => a.id !== id));
    } catch (err) {
      console.error('[AdminAppointments] Failed to delete appointment:', err);
    }
  };

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
      {confirmDialog}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Appointments</h1>
          <p className="text-sm text-slate-400 mt-1">All appointments across all salons</p>
        </div>
        <button type="button" onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all text-sm font-semibold">
          <Plus className="w-4 h-4" /> New Appointment
        </button>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <SalonLocationFilter salonFilter={filter.salon_id} setSalonFilter={(v) => setFilter({ ...filter, salon_id: v })} salons={salons} setSalons={setSalons} adminFetch={adminFetch} />
        <input placeholder="Date (YYYY-MM-DD)" value={filter.date} onChange={(e) => setFilter({ ...filter, date: e.target.value })}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 w-40" />
        <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All Status</option>
          {STATUSES.filter(Boolean).map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden animate-pulse">
          <div className="p-4 border-b border-slate-700">
            <div className="h-4 bg-slate-700 rounded w-full" />
          </div>
          <div className="space-y-1 p-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <div className="h-4 bg-slate-700 rounded w-28" />
                <div className="h-4 bg-slate-700 rounded w-24" />
                <div className="h-4 bg-slate-700 rounded w-20" />
                <div className="h-4 bg-slate-700 rounded w-32" />
                <div className="h-4 bg-slate-700 rounded w-24" />
                <div className="h-5 bg-slate-700 rounded w-16 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-indigo-600/15 border border-indigo-500/30 rounded-xl">
            <span className="text-sm text-indigo-200 font-medium">{selectedIds.size} selected</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={clearSelection} className="px-3 py-1.5 text-sm text-slate-300 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors">Clear</button>
              <button type="button" onClick={bulkDelete} disabled={bulkDeleting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                <Trash2 className="w-4 h-4" /> {bulkDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        )}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/50">
                <th className="text-left px-3 py-3 w-10">
                  <input type="checkbox" checked={paginatedAppointments.length > 0 && selectedIds.size === paginatedAppointments.length} onChange={toggleSelectAll}
                    className="w-4 h-4 rounded cursor-pointer accent-indigo-500" />
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Salon</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Barber</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Service</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Date/Time</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {appointments.length === 0 ? (
                <tr><td colSpan={8}><div className="px-6 py-8"><EmptyState icon={Calendar} title="No appointments found" description="Appointments will appear here when customers book" /></div></td></tr>
              ) : paginatedAppointments.map((a: any) => (
                <tr key={a.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 group">
                  <td className="px-3 py-3.5">
                    <input type="checkbox" checked={selectedIds.has(a.id)} onChange={() => toggleSelect(a.id)} className="w-4 h-4 rounded cursor-pointer accent-indigo-500" />
                  </td>
                  <td className="px-4 py-3"><span className="flex items-center gap-1.5 text-sm text-white"><Store className="w-3.5 h-3.5 text-slate-400" />{a.salon_name}</span></td>
                  <td className="px-4 py-3"><span className="flex items-center gap-1.5 text-sm text-slate-200"><User className="w-3.5 h-3.5 text-slate-400" />{a.customer_name || a.customer_phone}</span></td>
                  <td className="px-4 py-3 text-sm text-slate-300">{a.barber_name}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{a.service_name}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{format(new Date(a.appointment_date), 'MMM d')} {a.appointment_time}</td>
                   <td className="px-4 py-3"><span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge(a.status)}`}>{a.status?.replace('_', ' ')}</span>{a.recurring_booking_id ? <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-violet-500/20 text-violet-400 border border-violet-500/30">Recurring</span> : null}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {a.status === 'pending' && <button type="button" onClick={() => updateStatus(a.id, 'confirmed')} className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg"><CheckCircle className="w-3.5 h-3.5" /></button>}
                      {a.status === 'confirmed' && <button type="button" onClick={() => updateStatus(a.id, 'in_progress')} className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg"><Play className="w-3.5 h-3.5" /></button>}
                      {a.status === 'in_progress' && <button type="button" onClick={() => updateStatus(a.id, 'completed')} className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg"><CheckCircle className="w-3.5 h-3.5" /></button>}
                      {!['cancelled', 'completed', 'no_show'].includes(a.status) && <button type="button" onClick={() => updateStatus(a.id, 'cancelled')} className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg"><XCircle className="w-3.5 h-3.5" /></button>}
                      <button type="button" onClick={() => openEdit(a)} className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => deleteAppt(a.id)} className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div className="border-t border-slate-700">
            <Pagination page={page} totalPages={Math.ceil(appointments.length / ITEMS_PER_PAGE)} onPageChange={setPage} />
          </div>
        </div>
      </>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowModal(false)}>
          <div onClick={(e) => e.stopPropagation()}
            className="bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-lg border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">{editing ? 'Edit Appointment' : 'New Appointment'}</h2>
              <button type="button" onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-white rounded-lg"><X className="w-5 h-5" /></button>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Date *</label>
                  <input type="date" value={form.appointment_date} onChange={(e) => { setForm({ ...form, appointment_date: e.target.value }); setFormErrors(e => ({ ...e, appointment_date: '' })); }}
                    className={`w-full px-4 py-2.5 bg-slate-700 border rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${formErrors.appointment_date ? 'border-rose-500' : 'border-slate-600'}`} />
                  {formErrors.appointment_date && <p className="text-rose-400 text-xs mt-1">{formErrors.appointment_date}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Time *</label>
                  <input type="time" value={form.appointment_time} onChange={(e) => { setForm({ ...form, appointment_time: e.target.value }); setFormErrors(e => ({ ...e, appointment_time: '' })); }}
                    className={`w-full px-4 py-2.5 bg-slate-700 border rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${formErrors.appointment_time ? 'border-rose-500' : 'border-slate-600'}`} />
                  {formErrors.appointment_time && <p className="text-rose-400 text-xs mt-1">{formErrors.appointment_time}</p>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {STATUSES.filter(Boolean).map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 border border-slate-600 text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-700 transition-all">Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-all disabled:opacity-50">
                {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
