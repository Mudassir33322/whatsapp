import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Smartphone, RefreshCw, Wifi, WifiOff, Loader2, Trash2 } from 'lucide-react';
import { useAdminAuth } from './AdminAuthContext';

export function AdminWhatsApp() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const { token } = useAdminAuth();

  const fetchSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/sessions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setSessions(await res.json());
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [token]);

  const disconnectSession = async (sessionId: string) => {
    if (!confirm(`Disconnect WhatsApp session "${sessionId}"?`)) return;
    setActionMsg(`Disconnecting ${sessionId}...`);
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to disconnect');
      setActionMsg('Session disconnected');
      fetchSessions();
    } catch (e: any) {
      setActionMsg(`Error: ${e?.message}`);
    }
    setTimeout(() => setActionMsg(null), 3000);
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">WhatsApp Sessions</h1>
          <p className="text-sm text-slate-400 mt-1">Manage all WhatsApp connections</p>
        </div>
        <button
          onClick={fetchSessions}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 text-sm font-medium transition-all"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">
          {error}
        </div>
      )}

      {actionMsg && (
        <div className="mb-4 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 text-sm">
          {actionMsg}
        </div>
      )}

      <div className="grid gap-4">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Smartphone className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm font-medium">No WhatsApp sessions found</p>
            <p className="text-xs mt-1">Go to Live QR to connect a new session</p>
          </div>
        ) : sessions.map((s: any) => (
          <motion.div
            key={s.id || s.session_id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-800 rounded-xl p-5 border border-slate-700"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  s.status === 'connected' ? 'bg-emerald-500/20' : 'bg-rose-500/20'
                }`}>
                  <Smartphone className={`w-5 h-5 ${
                    s.status === 'connected' ? 'text-emerald-400' : 'text-rose-400'
                  }`} />
                </div>
                <div>
                  <p className="font-semibold text-white">{s.session_id || s.id || 'AutoZap Admin'}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {s.status === 'connected' ? 'Connected' : s.status || 'Unknown'}
                  </p>
                  {s.user && <p className="text-xs text-slate-500 mt-0.5">User: {s.user}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                  s.status === 'connected' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                }`}>
                  {s.status === 'connected' ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                  {s.status === 'connected' ? 'Connected' : 'Disconnected'}
                </span>
                <button
                  onClick={() => disconnectSession(s.session_id || s.id)}
                  className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                  title="Disconnect"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
