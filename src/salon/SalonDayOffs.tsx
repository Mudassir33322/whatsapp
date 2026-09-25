import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { CalendarX, Plus, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { salonFetch } from './api';
import { format } from 'date-fns';
import { useConfirm } from '../hooks/useConfirm';

interface DayOff { id: number; date: string; reason?: string }

export function SalonDayOffs() {
  const { confirm, confirmDialog } = useConfirm();
  const [dayOffs, setDayOffs] = useState<DayOff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newReason, setNewReason] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchDayOffs = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const r = await salonFetch('/api/salon/day-offs', { signal });
      if (r.ok) setDayOffs(await r.json());
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    const ac = new AbortController();
    fetchDayOffs(ac.signal);
    return () => ac.abort();
  }, []);

  const addDayOff = async () => {
    if (!newDate) return;
    setSaving(true);
    try {
      const r = await salonFetch('/api/salon/day-offs', {
        method: 'POST',
        body: JSON.stringify({ date: newDate, reason: newReason }),
      });
      if (r.ok) {
        setShowAdd(false);
        setNewDate('');
        setNewReason('');
        await fetchDayOffs();
      }
    } catch {} finally { setSaving(false); }
  };

  const removeDayOff = async (id: number) => {
    const confirmed = await confirm('Remove Day Off', 'Are you sure you want to remove this day off? The salon will be open on this date.', 'Remove', 'danger');
    if (!confirmed) return;
    try {
      await salonFetch(`/api/salon/day-offs/${id}`, { method: 'DELETE' });
      setDayOffs(prev => prev.filter(d => d.id !== id));
    } catch {}
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {confirmDialog}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <CalendarX className="w-6 h-6 text-amber-500" />
            Day Offs
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage dates when your salon will be closed</p>
        </div>
        <button type="button" onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg shadow-amber-200">
          <Plus className="w-4 h-4" /> Add Day Off
        </button>
      </div>

      {dayOffs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-white/60 rounded-2xl border border-amber-100/50">
          <CalendarX className="w-12 h-12 mb-3 opacity-40" />
          <p className="text-sm font-medium">No day offs scheduled</p>
          <p className="text-xs mt-1 text-slate-400">Add dates when your salon will be closed</p>
        </div>
      ) : (
        <div className="space-y-2">
          {dayOffs.map((d, i) => (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center justify-between bg-white/80 backdrop-blur rounded-xl border border-amber-100/50 p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
                  <CalendarX className="w-5 h-5 text-rose-500" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{d.date ? format(new Date(d.date), 'EEEE, MMMM d, yyyy') : '—'}</p>
                  {d.reason && <p className="text-xs text-slate-500 mt-0.5">{d.reason}</p>}
                </div>
              </div>
              <button type="button" onClick={() => removeDayOff(d.id)}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                <Trash2 className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowAdd(false)}>
          <div onClick={(e) => e.stopPropagation()}
            className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl p-6 w-full max-w-md border border-amber-100">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Add Day Off</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Date *</label>
                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white/50" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Reason (optional)</label>
                <input type="text" value={newReason} onChange={(e) => setNewReason(e.target.value)}
                  placeholder="e.g. Holiday, maintenance, etc."
                  className="w-full px-3.5 py-2.5 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white/50" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setShowAdd(false)}
                className="flex-1 px-4 py-2.5 border border-amber-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-amber-50 transition-all">Cancel</button>
              <button type="button" onClick={addDayOff} disabled={saving || !newDate}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-semibold hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 shadow-lg shadow-amber-200">
                {saving ? 'Adding...' : 'Add Day Off'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
