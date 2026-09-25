import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { Smartphone, RefreshCw, Wifi, WifiOff, Loader2, Trash2, Signal, AlertCircle, Plus, X, Edit3 } from 'lucide-react';
import { useAdminAuth } from './AdminAuthContext';
import { useConfirm } from '../hooks/useConfirm';

export function AdminWhatsApp() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const { adminFetch } = useAdminAuth();
  const { confirm, confirmDialog } = useConfirm();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [sessionName, setSessionName] = useState('');
  const actionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearActionTimer = useCallback(() => {
    if (actionTimerRef.current) { clearTimeout(actionTimerRef.current); actionTimerRef.current = null; }
  }, []);

  const scheduleClear = useCallback((ms: number) => {
    clearActionTimer();
    actionTimerRef.current = setTimeout(() => setActionMsg(null), ms);
  }, [clearActionTimer]);

  useEffect(() => () => clearActionTimer(), [clearActionTimer]);

  const fetchSessions = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch('/api/admin/sessions', { signal });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setSessions(await res.json());
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setError(e?.message || 'Failed to fetch sessions');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const ac = new AbortController();
    fetchSessions(ac.signal);
    return () => ac.abort();
  }, []);

  const disconnectSession = async (sid: string) => {
    const confirmed = await confirm('Disconnect Session', `Are you sure you want to disconnect WhatsApp session "${sid}"?`, 'Disconnect', 'danger');
    if (!confirmed) return;
    setActionMsg(`Disconnecting ${sid}...`);
    try {
      const res = await adminFetch(`/api/admin/sessions/${sid}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to disconnect');
      setActionMsg('Session disconnected');
      fetchSessions();
    } catch (e: any) { setActionMsg(`Error: ${e?.message}`); }
    scheduleClear(3000);
  };

  const restartSession = async (sid: string) => {
    const confirmed = await confirm('Restart Session', `Restart WhatsApp session "${sid}"? This will generate a new QR code to scan.`, 'Restart', 'danger');
    if (!confirmed) return;
    setActionMsg(`Restarting ${sid}...`);
    try {
      const res = await adminFetch(`/api/admin/sessions/restart`, { method: 'POST', body: JSON.stringify({ sessionId: sid }) });
      if (!res.ok) throw new Error('Failed to restart');
      setActionMsg('Session restarting - check Live QR page for new QR code');
      fetchSessions();
    } catch (e: any) { setActionMsg(`Error: ${e?.message}`); }
    scheduleClear(5000);
  };

  const saveSession = async () => {
    if (editingId) {
      if (!sessionName.trim()) return;
      setActionMsg(`Updating ${editingId}...`);
      try {
        const res = await adminFetch(`/api/admin/sessions/${editingId}`, {
          method: 'PUT', body: JSON.stringify({ name: sessionName.trim() }),
        });
        if (!res.ok) throw new Error('Failed');
        setActionMsg('Session updated');
      } catch (e: any) { setActionMsg(`Error: ${e?.message}`); }
    } else {
      if (!sessionId.trim()) return;
      setActionMsg(`Initializing ${sessionId}...`);
      try {
        const res = await adminFetch('/api/admin/sessions/init', {
          method: 'POST', body: JSON.stringify({ sessionId: sessionId.trim() }),
        });
        if (!res.ok) throw new Error('Failed');
        setActionMsg('Session initialized! Scan QR in Live QR page.');
      } catch (e: any) { setActionMsg(`Error: ${e?.message}`); }
    }
    setShowModal(false);
    setEditingId(null);
    setSessionId('');
    setSessionName('');
    fetchSessions();
    scheduleClear(5000);
  };

  const openEdit = (s: any) => {
    setEditingId(s.session_id || s.id);
    setSessionId(s.session_id || s.id);
    setSessionName(s.name || '');
    setShowModal(true);
  };

  const openCreate = () => {
    setEditingId(null);
    setSessionId('');
    setSessionName('');
    setShowModal(true);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400">Loading sessions...</p>
      </div>
    </div>
  );

  return (
    <div>
      {confirmDialog}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-amber-400" />
            WhatsApp Sessions
          </h1>
          <p className="text-sm text-slate-400 mt-1">Manage all WhatsApp connections across the platform</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl hover:shadow-lg transition-all text-sm font-semibold">
            <Plus className="w-4 h-4" /> New Session
          </button>
          <button type="button" onClick={() => fetchSessions()} disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-700/50 text-slate-300 rounded-xl hover:bg-slate-600/50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-all border border-slate-600/50">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {actionMsg && (
        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400 text-sm flex items-center gap-2">
          <Signal className="w-4 h-4 shrink-0" />
          {actionMsg}
        </div>
      )}

      <div className="grid gap-4">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 bg-slate-800/30 rounded-2xl border border-slate-700/50">
            <Smartphone className="w-14 h-14 mb-3 opacity-30" />
            <p className="text-sm font-medium">No WhatsApp sessions found</p>
            <p className="text-xs mt-1 text-slate-600">Click "New Session" to get started</p>
          </div>
        ) : sessions.map((s: any, i: number) => (
          <motion.div
            key={s.id || s.session_id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-slate-800/60 backdrop-blur rounded-2xl p-5 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-300"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  s.status === 'connected' ? 'bg-emerald-500/15' : 'bg-rose-500/15'
                }`}>
                  <Smartphone className={`w-6 h-6 ${
                    s.status === 'connected' ? 'text-emerald-400' : 'text-rose-400'
                  }`} />
                </div>
                <div>
                  <p className="font-semibold text-white">{s.session_id || s.id || 'AutoZap Admin'}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {s.status === 'connected' ? 'Connected and active' : s.status || 'Unknown'}
                  </p>
                  {s.user && <p className="text-xs text-slate-500 mt-0.5">Linked to: {s.user}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border ${
                  s.status === 'connected'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                }`}>
                  {s.status === 'connected' ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                  {s.status === 'connected' ? 'Connected' : 'Disconnected'}
                </span>
                <button type="button" onClick={() => openEdit(s)}
                  className="p-2.5 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all"
                  title="Edit session">
                  <Edit3 className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => restartSession(s.session_id || s.id)} disabled={loading}
                  className="p-2.5 text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all"
                  title="Restart session (generate new QR)">
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => disconnectSession(s.session_id || s.id)} disabled={loading}
                  className="p-2.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all"
                  title="Disconnect session">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => { setShowModal(false); setEditingId(null); }}>
          <div onClick={(e) => e.stopPropagation()} className="bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">{editingId ? 'Edit Session' : 'New WhatsApp Session'}</h2>
              <button type="button" onClick={() => { setShowModal(false); setEditingId(null); }} className="p-1 text-slate-400 hover:text-white rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              {!editingId && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Session ID</label>
                  <input type="text" value={sessionId} onChange={(e) => setSessionId(e.target.value)}
                    placeholder="e.g. main-session, salon-1"
                    className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-400" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Session Name</label>
                <input type="text" value={sessionName} onChange={(e) => setSessionName(e.target.value)}
                  placeholder="e.g. Main WhatsApp"
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-400" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => { setShowModal(false); setEditingId(null); }}
                className="flex-1 px-4 py-2.5 border border-slate-600 text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-700 transition-all">Cancel</button>
              <button type="button" onClick={saveSession} disabled={editingId ? !sessionName.trim() : !sessionId.trim()}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-all disabled:opacity-50">
                {editingId ? 'Save' : 'Initialize'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
