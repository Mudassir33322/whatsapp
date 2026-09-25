import { useState, useRef, useCallback, useEffect } from 'react';
import { QrCode, Smartphone, Loader2, RefreshCw, Wifi, WifiOff, XCircle, Crown, ScanLine, AlertTriangle, ExternalLink, ChevronDown } from 'lucide-react';
import QRCodeLib from 'qrcode';
import { useAdminAuth } from './AdminAuthContext';

export function AdminLiveQR() {
  const { adminFetch } = useAdminAuth();
  const [qr, setQr] = useState('');
  const [qrImageUrl, setQrImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<string>('loading');
  const [timeLeft, setTimeLeft] = useState(60);
  const [qrExpired, setQrExpired] = useState(false);
  const [lastErrorCode, setLastErrorCode] = useState<number | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const timerRef = useRef<any>(null);
  const pollRef = useRef<any>(null);

  const currentSession = sessions.find(s => (s.session_id || s.id) === selectedSessionId) || sessions[0];

  const fetchStatus = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/sessions');
      if (!res.ok) {
        if (res.status === 403) {
          setError('Aap admin nahi hain ya aapka role sessions dekhne ke liye authorized nahi hai. Super admin se contact karein.');
        } else {
          const txt = await res.text().catch(() => '');
          setError(`API error ${res.status}: ${txt}`);
        }
        setStatus('ERROR');
        return;
      }
      const data = await res.json();
      const sessionList = Array.isArray(data) ? data : [];
      setSessions(sessionList);
      
      if (sessionList.length === 0) {
        setError('No WhatsApp sessions found. Create a new session to get started.');
        setStatus('DISCONNECTED');
        return;
      }

      const target = selectedSessionId 
        ? sessionList.find(x => (x.session_id || x.id) === selectedSessionId)
        : sessionList.find(x => x.session_id === 'autozap-admin' || x.id === 'autozap-admin') || sessionList[0];
      
      if (!target) {
        setError('Session not found');
        setStatus('DISCONNECTED');
        return;
      }

      if (!selectedSessionId) {
        setSelectedSessionId(target.session_id || target.id);
      }

      setError('');
      const st = (target.live_status || target.status || 'DISCONNECTED').toUpperCase();
      setStatus(st);
      if (target.qr) setQr(target.qr);
      if (target.message?.includes('515')) setLastErrorCode(515);
      else if (target.message) setLastErrorCode(null);
    } catch (e: any) {
      setError(`Fetch error: ${e?.message || e}`);
      setStatus('ERROR');
    }
  }, [adminFetch, selectedSessionId]);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      if (!active) return;
      await fetchStatus();
      if (active) pollRef.current = setTimeout(poll, 3000);
    };
    poll();
    return () => {
      active = false;
      clearTimeout(pollRef.current);
      clearTimeout(timerRef.current);
    };
  }, [fetchStatus]);

  useEffect(() => {
    if (qr) {
      QRCodeLib.toDataURL(qr, { width: 300, margin: 2, color: { dark: '#1e1b4b', light: '#ffffff' } })
        .then(setQrImageUrl)
        .catch((err) => { console.error('[AdminLiveQR] Failed to generate QR:', err); });
      setTimeLeft(60);
      setQrExpired(false);
      if (!timerRef.current) {
        timerRef.current = setInterval(() => {
          setTimeLeft((t) => {
            if (t <= 1) { clearInterval(timerRef.current); timerRef.current = null; setQrExpired(true); return 0; }
            return t - 1;
          });
        }, 1000);
      }
    }
    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, [qr]);

  useEffect(() => {
    if (status !== 'QR_READY' && status !== 'RECONNECTING') {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setTimeLeft(60);
      setQrExpired(false);
      if (status !== 'CONNECTING') setQrImageUrl('');
    }
  }, [status]);

  const handleRestart = useCallback(async () => {
    const sid = selectedSessionId || 'autozap-admin';
    setLoading(true);
    setQr('');
    setQrImageUrl('');
    setError('');
    setStatus('CONNECTING');
    try {
      const res = await adminFetch('/api/admin/sessions/restart', {
        method: 'POST',
        body: JSON.stringify({ sessionId: sid })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Restart failed' }));
        setError(errData.error || `Restart failed (${res.status})`);
      }
    } catch (e: any) {
      setError(`Restart error: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  }, [adminFetch, selectedSessionId]);

  const handleSessionChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSessionId(e.target.value);
    setQr('');
    setQrImageUrl('');
    setStatus('loading');
    setQrExpired(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const connected = status === 'CONNECTED';
  const hasQR = status === 'QR_READY' && !!qr;
  const showSpinner = status === 'loading' || status === 'CONNECTING' || status === 'RECONNECTING';
  const displaySessionId = currentSession?.session_id || currentSession?.id || selectedSessionId || 'autozap-admin';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Crown className="w-6 h-6 text-amber-400" />
            WhatsApp Connection
          </h1>
          <p className="text-sm text-slate-400 mt-1">Connect your WhatsApp business number to the platform</p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold border ${
          connected
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : hasQR
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
        }`}>
          {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          {connected ? 'Connected' : hasQR ? 'Scan QR' : status}
        </div>
      </div>

      {sessions.length > 1 && (
        <div className="mb-4 p-4 bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700/50">
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Select Session</label>
          <div className="relative">
            <select
              value={selectedSessionId}
              onChange={handleSessionChange}
              className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-3 py-2.5 text-sm text-slate-200 appearance-none focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            >
              {sessions.map((s: any) => (
                <option key={s.session_id || s.id} value={s.session_id || s.id}>
                  {s.name || s.session_id || s.id} — {((s.live_status || s.status || 'DISCONNECTED') as string).toUpperCase()}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="font-semibold">Connection Issue</span>
          </div>
          <p className="text-rose-300/80 ml-6">{error}</p>
          {lastErrorCode === 515 && (
            <div className="mt-3 ml-6 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs">
              <p className="font-semibold mb-1">📱 WhatsApp se bahut zyada devices link ho gayi hain:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Apne phone mein <strong>WhatsApp</strong> kholen</li>
                <li><strong>Linked Devices</strong> mein jayen</li>
                <li>Purani <strong>AutoZap</strong> sessions ko remove karein (jo :96, :97, :98 hon)</li>
                <li>Phir yahan se naya QR scan karein</li>
              </ol>
            </div>
          )}
        </div>
      )}

      {connected ? (
        <div className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700/50 p-10 text-center">
          <div className="w-20 h-20 bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto mb-5">
            <Smartphone className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">WhatsApp Connected</h2>
          <p className="text-sm text-slate-400">AutoZap Admin is linked and running</p>
          <div className="flex items-center justify-center gap-2 mt-4 mb-6">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-xs text-slate-500">Session: {displaySessionId}</p>
          </div>
          <button type="button" onClick={handleRestart} disabled={loading}
            className="px-5 py-2.5 bg-slate-700/50 text-slate-300 rounded-xl hover:bg-slate-600/50 disabled:opacity-50 text-sm font-medium transition-all border border-slate-600/50">
            Reconnect
          </button>
        </div>
      ) : hasQR ? (
        <div className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700/50 p-8">
          <div className="text-center">
            {qrExpired ? (
              <div className="py-8">
                <div className="w-20 h-20 bg-rose-500/15 rounded-full flex items-center justify-center mx-auto mb-5">
                  <AlertTriangle className="w-10 h-10 text-rose-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">QR Expired</h2>
                <p className="text-sm text-slate-400 mb-2">The QR code expired. New QR will generate automatically.</p>
                <p className="text-xs text-slate-500 mb-6">No need to click anything — just wait a moment or tap below.</p>
                <button type="button" onClick={handleRestart} disabled={loading}
                  className="flex items-center gap-2 mx-auto px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-sm font-semibold transition-all shadow-lg shadow-amber-500/20">
                  <RefreshCw className="w-4 h-4" /> Generate New QR
                </button>
                {lastErrorCode === 515 && (
                  <div className="mt-4 mx-auto max-w-md p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs text-left">
                    <p className="font-semibold mb-1">📱 Pehle phone se purani devices hatao:</p>
                    <p>WhatsApp → Linked Devices → purani AutoZap sessions remove karo → phir QR scan karo</p>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="bg-white rounded-2xl p-4 inline-block mb-4 shadow-xl shadow-black/20">
                  {qrImageUrl ? (
                    <img src={qrImageUrl} alt="WhatsApp QR" className="w-64 h-64" />
                  ) : (
                    <div className="w-64 h-64 flex items-center justify-center bg-slate-100 rounded-lg">
                      <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-center gap-2 text-sm text-slate-300 mb-1">
                  <ScanLine className="w-4 h-4 text-amber-400" />
                  Scan with <strong className="text-white">WhatsApp → Link Device</strong>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  QR expires in <span className="text-amber-400 font-bold text-sm">{timeLeft}s</span>
                </p>
                <div className="w-64 bg-slate-700 rounded-full h-2 mb-5 mx-auto overflow-hidden">
                  <div className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 rounded-full transition-all duration-1000" style={{ width: `${(timeLeft / 60) * 100}%` }} />
                </div>
                <button type="button" onClick={handleRestart} disabled={loading}
                  className="flex items-center gap-2 mx-auto px-5 py-2.5 bg-slate-700/50 text-slate-300 rounded-xl hover:bg-slate-600/50 disabled:opacity-50 text-sm font-medium transition-all border border-slate-600/50">
                  <RefreshCw className="w-4 h-4" /> Generate New QR
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700/50 p-10 text-center">
          <div className={`w-20 h-20 ${showSpinner ? 'bg-amber-500/15' : 'bg-slate-700/50'} rounded-full flex items-center justify-center mx-auto mb-5`}>
            {showSpinner ? (
              <Loader2 className="w-10 h-10 animate-spin text-amber-400" />
            ) : (
              <QrCode className="w-10 h-10 text-slate-400" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {showSpinner ? status === 'CONNECTING' ? 'Initializing WhatsApp...' : 'Connecting...' : 'Connect WhatsApp'}
          </h2>
          <p className="text-sm text-slate-400 mb-6">
            {showSpinner ? 'Please wait while we generate a QR code' : 'Generate a QR code to link your WhatsApp Business'}
          </p>
          <button type="button" onClick={handleRestart} disabled={loading}
            className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 font-semibold text-sm transition-all shadow-lg shadow-amber-500/20">
            {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null}
            {showSpinner ? 'Force New QR' : 'Generate Live QR'}
          </button>
        </div>
      )}
    </div>
  );
}
