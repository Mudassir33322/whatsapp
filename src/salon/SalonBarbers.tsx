import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserPlus, Pencil, Trash2, Clock, X, Loader2, Star, Scissors, Phone, Mail, Calendar, CheckCircle2, Upload } from 'lucide-react';
import { salonFetch } from './api';
import { API_URL } from '../config';
import { mediaUrl } from '../lib/mediaUrl';
import { EmptyState } from '../components/EmptyState';
import { useConfirm } from '../hooks/useConfirm';

interface Barber { id: number; name: string; phone: string; email: string; bio: string; experience: number; specialization: string; profile_image: string; rating: number; status: string; }
interface ScheduleEntry { id?: number; day_of_week: string; start_time: string; end_time: string; slot_duration: number; is_available: boolean; break_start?: string; break_end?: string; }

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const DAY_MAP: Record<string, number> = { Sunday:0, Monday:1, Tuesday:2, Wednesday:3, Thursday:4, Friday:5, Saturday:6 };
const DF = { name:'', phone:'', email:'', bio:'', experience:0, specialization:'', profile_image:'', status:'active' };

export function SalonBarbers() {
  const { confirm, confirmDialog } = useConfirm();
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const fetchAll = async (signal?: AbortSignal) => {
    try {
      const r = await salonFetch('/api/salon/barbers', { signal });
      if (!r.ok) throw new Error('Failed to fetch');
      setBarbers(await r.json());
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setError(e.message);
    }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const ac = new AbortController();
    fetchAll(ac.signal);
    return () => ac.abort();
  }, []);

  const saveBarber = async () => {
    setSaving(true);
    try {
      const url = editing ? `/api/salon/barbers/${editing.id}` : '/api/salon/barbers';
      const r = await salonFetch(url, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(form) });
      if (!r.ok) throw new Error('Failed to save');
      const data = await r.json().catch(() => ({} as any));
      const barberId = editing ? editing.id : data.id;
      // Upload image after the barber exists (works for BOTH new and existing barbers)
      if (selectedFile && barberId) {
        await uploadBarberImage(selectedFile, barberId);
      }
      await fetchAll();
      resetForm();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm(DF);
    setSelectedFile(null);
    setPreviewUrl('');
  };

  const delBarber = async (id: number) => {
    const confirmed = await confirm('Delete Barber', 'Are you sure you want to delete this barber? This will remove their profile and schedule permanently.', 'Delete', 'danger');
    if (!confirmed) return;
    try {
      const r = await salonFetch(`/api/salon/barbers/${id}`, { method:'DELETE' });
      if (!r.ok) throw new Error('Failed to delete');
      setBarbers((p) => p.filter((b) => b.id !== id));
    } catch (e: any) { setError(e.message); }
  };

  const edit = (b: Barber) => {
    setForm({ name:b.name, phone:b.phone, email:b.email, bio:b.bio, experience:b.experience, specialization:b.specialization, profile_image:b.profile_image, status:b.status });
    setEditing(b); setShowForm(true);
  };

  const openSched = async (b: Barber) => {
    setSchedBarber(b);
    try {
      const r = await salonFetch(`/api/salon/barbers/${b.id}/schedule`);
      if (r.ok) {
        const existing: any[] = await r.json();
        setSchedule(DAYS.map((d) => {
          const dayNum = DAY_MAP[d];
          const x = existing.find((s) => Number(s.day_of_week) === dayNum);
          return x
            ? { day_of_week: d, start_time: x.start_time || '09:00', end_time: x.end_time || '18:00', slot_duration: x.slot_duration || 30, is_available: x.is_available !== false, break_start: x.break_start || '', break_end: x.break_end || '' }
            : { day_of_week: d, start_time:'09:00', end_time:'18:00', slot_duration:30, is_available:true, break_start:'', break_end:'' };
        }));
        return;
      }
    } catch (_) {}
    setSchedule(DAYS.map((d) => ({ day_of_week: d, start_time:'09:00', end_time:'18:00', slot_duration:30, is_available:true, break_start:'', break_end:'' })));
  };

  const saveSched = async () => {
    if (!schedBarber) return;
    setSavingSched(true);
    try {
      const payload = schedule.map((s) => ({ ...s, day_of_week: DAY_MAP[s.day_of_week] }));
      const r = await salonFetch(`/api/salon/barbers/${schedBarber.id}/schedule`, { method:'PUT', body: JSON.stringify({ schedule: payload }) });
      if (!r.ok) throw new Error('Failed to save schedule');
      await fetchAll();
      setSchedBarber(null);
    } catch (e: any) { setError(e.message); }
    finally { setSavingSched(false); }
  };

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const uploadBarberImage = async (file: File, barberId: number) => {
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const token = localStorage.getItem('salon-token');
      const r = await fetch(`${API_URL}/api/salon/barbers/${barberId}/image`, {
        method: 'POST',
        headers: token ? { Authorization: 'Bearer ' + token } : {},
        body: fd
      });
      if (!r.ok) throw new Error('Upload failed');
      const data = await r.json();
      setForm((prev) => ({ ...prev, profile_image: data.url }));
      await fetchAll();
    } catch (e: any) { setError(e.message); }
    finally { setUploadingImage(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Loading barbers...</p>
      </div>
    </div>
  );
  if (error && !barbers.length) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-rose-50 text-rose-700 px-6 py-4 rounded-2xl border border-rose-200 text-sm font-medium shadow-sm">{error}</div>
    </div>
  );

  const fields: { key: keyof typeof DF; label: string; type?: string }[] = [
    { key:'name', label:'Name' }, { key:'phone', label:'Phone' }, { key:'email', label:'Email' },
    { key:'specialization', label:'Specialization' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {confirmDialog}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Barbers</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your barber team & their schedules</p>
        </div>
        <button type="button" onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg shadow-amber-200">
          <UserPlus className="w-4 h-4" /> Add Barber
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 text-rose-700 px-4 py-3 rounded-2xl border border-rose-200 text-sm shadow-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {!barbers.length ? (
          <div className="col-span-full">
            <EmptyState icon={Scissors} title="No barbers added yet" description="Click 'Add Barber' to get started" />
          </div>
        ) : barbers.map((b, i) => (
          <motion.div
            key={b.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white/80 backdrop-blur rounded-2xl border border-amber-100/50 p-5 hover:shadow-lg hover:shadow-amber-100/50 transition-all duration-300"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {b.profile_image ? (
                  <img src={b.profile_image} alt="" className="w-12 h-12 rounded-xl object-cover ring-2 ring-amber-100" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center text-lg font-bold shadow-sm">
                    {b.name[0]}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-slate-800">{b.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {b.rating ? (
                      <span className="flex items-center gap-0.5 text-xs text-amber-600 font-medium">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        {b.rating}
                      </span>
                    ) : null}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      b.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {b.status || 'active'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-1.5 text-xs text-slate-500">
              {b.specialization && (
                <div className="flex items-center gap-2">
                  <Scissors className="w-3.5 h-3.5 text-amber-400" />
                  <span>{b.specialization}</span>
                </div>
              )}
              {b.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-amber-400" />
                  <span>{b.phone}</span>
                </div>
              )}
              {b.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-amber-400" />
                  <span className="truncate">{b.email}</span>
                </div>
              )}
              {b.experience ? (
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>{b.experience} years experience</span>
                </div>
              ) : null}
              {b.bio && (
                <p className="text-slate-400 mt-1.5 line-clamp-2 border-t border-amber-50 pt-2">{b.bio}</p>
              )}
            </div>

            <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-amber-50">
              <button type="button" onClick={() => edit(b)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
              <button type="button" onClick={() => openSched(b)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all">
                <Calendar className="w-3.5 h-3.5" /> Schedule
              </button>
              <button type="button" onClick={() => delBarber(b.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => resetForm()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-lg border border-amber-100 p-6 space-y-5 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button type="button" onClick={() => resetForm()} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-amber-50 rounded-xl transition-all">
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Scissors className="w-5 h-5 text-amber-500" />
                {editing ? 'Edit Barber' : 'Add Barber'}
              </h2>
              <div className="space-y-4">
                {fields.map((f) => (
                  <div key={f.key}>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                      {f.label}{f.key==='name' && <span className="text-rose-400 ml-1">*</span>}
                    </label>
                     <input type="text" value={form[f.key] as string}
                       onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                       className="w-full px-3.5 py-2.5 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300 bg-white/50 transition-all"
                       placeholder={`Enter ${f.label.toLowerCase()}`} />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Experience (yrs)</label>
                  <input type="number" value={form.experience}
                    onChange={(e) => setForm({ ...form, experience: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300 bg-white/50 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Bio</label>
                  <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    rows={3}
                    className="w-full px-3.5 py-2.5 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300 bg-white/50 transition-all resize-none"
                    placeholder="Brief bio..." />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Profile Image</label>
                  <div className="flex gap-2 items-start">
                    <div className="flex-1 space-y-2">
                   <input type="text" value={form.profile_image} onChange={(e) => setForm({ ...form, profile_image: e.target.value })}
                         className="w-full px-3.5 py-2.5 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300 bg-white/50 transition-all"
                         placeholder="Image URL ya upload karein..." />
                      <div
                        onClick={() => fileRef.current?.click()}
                        className="border-2 border-dashed border-amber-200 rounded-xl p-3 text-center cursor-pointer hover:border-amber-400 hover:bg-amber-50/50 transition-all"
                      >
                        <input ref={fileRef} type="file" accept="image/*" className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              setSelectedFile(f);
                              setPreviewUrl(URL.createObjectURL(f));
                            }
                            e.target.value = '';
                          }}
                        />
                        <Upload className="w-5 h-5 mx-auto mb-1 text-amber-400" />
                        <p className="text-xs font-medium text-slate-500">{uploadingImage ? 'Uploading...' : 'Click to upload image'}</p>
                      </div>
                    </div>
                     {(previewUrl || form.profile_image) && (
                       <img src={previewUrl || mediaUrl(form.profile_image)} alt="Preview" className="w-16 h-16 rounded-xl object-cover ring-2 ring-amber-100 shrink-0"
                         onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/64x64/e2e8f0/94a3b8?text=N/A'; }} />
                     )}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={resetForm}
                  className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all">
                  Cancel
                </button>
                <button type="button" onClick={saveBarber} disabled={saving || !form.name.trim()}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 rounded-xl transition-all inline-flex items-center gap-2 shadow-lg shadow-amber-200">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editing ? 'Update' : 'Save'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {schedBarber && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSchedBarber(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-2xl border border-amber-100 p-6 space-y-5 relative max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <button type="button" onClick={() => setSchedBarber(null)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-amber-50 rounded-xl transition-all">
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-500" />
                Schedule — {schedBarber.name}
              </h2>
              <div className="space-y-2.5">
                {schedule.map((e, i) => (
                  <motion.div
                    key={e.day_of_week}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                      e.is_available ? 'bg-amber-50/50 border border-amber-100' : 'bg-slate-50 border border-slate-100 opacity-60'
                    }`}
                  >
                    <div className="w-20 shrink-0">
                      <p className="text-sm font-semibold text-slate-700">{e.day_of_week.slice(0, 3)}</p>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-slate-600 shrink-0 cursor-pointer">
                      <input type="checkbox" checked={e.is_available}
                        onChange={(ev) => setSchedule((p) => p.map((s, j) => j === i ? { ...s, is_available: ev.target.checked } : s))}
                        className="rounded border-amber-300 text-amber-500 focus:ring-amber-400" />
                      Available
                    </label>
                    <input type="time" value={e.start_time}
                      onChange={(ev) => setSchedule((p) => p.map((s, j) => j === i ? { ...s, start_time: ev.target.value } : s))}
                      disabled={!e.is_available}
                      className="px-3 py-1.5 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-40 bg-white/50" />
                    <span className="text-slate-400 text-xs">to</span>
                    <input type="time" value={e.end_time}
                      onChange={(ev) => setSchedule((p) => p.map((s, j) => j === i ? { ...s, end_time: ev.target.value } : s))}
                      disabled={!e.is_available}
                      className="px-3 py-1.5 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-40 bg-white/50" />
                    <div className="flex items-center gap-1.5 ml-2">
                      <label className="text-xs text-slate-500 whitespace-nowrap">Slot:</label>
                      <input type="number" value={e.slot_duration}
                        onChange={(ev) => setSchedule((p) => p.map((s, j) => j === i ? { ...s, slot_duration: Number(ev.target.value) } : s))}
                        disabled={!e.is_available}
                        className="w-14 px-2 py-1.5 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-40 bg-white/50" />
                      <span className="text-xs text-slate-400">min</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <label className="text-[10px] text-slate-400">Break:</label>
                      <input type="time" value={e.break_start || ''}
                        onChange={(ev) => setSchedule((p) => p.map((s, j) => j === i ? { ...s, break_start: ev.target.value } : s))}
                        disabled={!e.is_available}
                        className="w-16 px-1 py-1 border border-amber-200 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-amber-300 disabled:opacity-40 bg-white/50" />
                      <span className="text-[10px] text-slate-400">-</span>
                      <input type="time" value={e.break_end || ''}
                        onChange={(ev) => setSchedule((p) => p.map((s, j) => j === i ? { ...s, break_end: ev.target.value } : s))}
                        disabled={!e.is_available}
                        className="w-16 px-1 py-1 border border-amber-200 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-amber-300 disabled:opacity-40 bg-white/50" />
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setSchedBarber(null)}
                  className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all">
                  Cancel
                </button>
                <button type="button" onClick={saveSched} disabled={savingSched}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 rounded-xl transition-all inline-flex items-center gap-2 shadow-lg shadow-amber-200">
                  {savingSched && <Loader2 className="w-4 h-4 animate-spin" />}
                  <CheckCircle2 className="w-4 h-4" />
                  Save Schedule
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
