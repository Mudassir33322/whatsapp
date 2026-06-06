import { useState, useRef, useCallback, useEffect } from 'react';
import { QrCode, Smartphone, Loader2, RefreshCw, Wifi, WifiOff, XCircle } from 'lucide-react';
import QRCodeLib from 'qrcode';
import { SocketProvider, useSocketContext } from '../context/SocketContext';
import type { SessionStatus } from '../context/SocketContext';

function LiveQRContent() {
  const { status, restartSession } = useSocketContext();
  const [qrImageUrl, setQrImageUrl] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState(60);
  const timerRef = useRef<any>(null);

  const sessionStatus: SessionStatus | null = status;
  const connected = sessionStatus?.status === 'CONNECTED';
  const qrData = sessionStatus?.status === 'QR_READY' ? sessionStatus?.qr : '';
  const hasQR = !!qrData;

  useEffect(() => {
    if (qrData) {
      QRCodeLib.toDataURL(qrData, { width: 300, margin: 2, color: { dark: '#1e1b4b', light: '#ffffff' } })
        .then(setQrImageUrl)
        .catch(() => {});
      setTimeLeft(60);
      if (!timerRef.current) {
        timerRef.current = setInterval(() => {
          setTimeLeft((t) => {
            if (t <= 1) { clearInterval(timerRef.current); timerRef.current = null; return 0; }
            return t - 1;
          });
        }, 1000);
      }
    }

    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, [qrData]);

  useEffect(() => {
    if (sessionStatus?.status !== 'QR_READY' && sessionStatus?.status !== 'RECONNECTING') {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setTimeLeft(60);
      setQrImageUrl('');
    }
  }, [sessionStatus?.status]);

  const refreshQR = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setQrImageUrl('');
    setTimeLeft(60);
    restartSession('autozap-admin');
  }, [restartSession]);

  if (!sessionStatus || sessionStatus.status === 'RECONNECTING') {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">WhatsApp Connection</h1>
          <p className="text-sm text-slate-400 mt-1">Connect your WhatsApp business number</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
          connected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
        }`}>
          {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          {connected ? 'Connected' : sessionStatus.status === 'QR_READY' ? 'Scan QR' : sessionStatus.status === 'CONNECTING' ? 'Connecting...' : 'Disconnected'}
        </div>
      </div>

      {connected ? (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Smartphone className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">WhatsApp Connected</h2>
          <p className="text-sm text-slate-400">AutoZap Admin is linked and running</p>
          <p className="text-xs text-slate-500 mt-1">Session: autozap-admin</p>
          <button onClick={refreshQR} className="mt-4 px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 text-sm font-medium transition-all">
            Reconnect
          </button>
        </div>
      ) : sessionStatus.status === 'CONNECTING' ? (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center">
          <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Initializing WhatsApp...</h2>
          <p className="text-sm text-slate-400 mb-6">Please wait while we generate a QR code</p>
          <button onClick={refreshQR} className="flex items-center gap-2 mx-auto px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 text-sm font-medium transition-all">
            <RefreshCw className="w-4 h-4" /> Force New QR
          </button>
        </div>
      ) : sessionStatus.status === 'ERROR' ? (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center">
          <div className="w-16 h-16 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-rose-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Connection Error</h2>
          <p className="text-sm text-slate-400 mb-6">{sessionStatus.message || 'Failed to initialize WhatsApp session'}</p>
          <button onClick={refreshQR} className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 font-semibold text-sm transition-all">
            Try Again
          </button>
        </div>
      ) : hasQR ? (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-8">
          <div className="text-center">
            <div className="bg-white rounded-2xl p-4 inline-block mb-4 shadow-lg">
              {qrImageUrl ? (
                <img src={qrImageUrl} alt="WhatsApp QR" className="w-64 h-64" />
              ) : (
                <div className="w-64 h-64 flex items-center justify-center bg-slate-100 rounded-lg">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
              )}
            </div>
            <p className="text-sm text-slate-300 mb-1">
              Scan this QR with <strong className="text-white">WhatsApp → Link Device</strong>
            </p>
            <p className="text-xs text-slate-500 mb-4">
              QR expires in <span className="text-amber-400 font-bold">{timeLeft}s</span>
            </p>
            <div className="w-full bg-slate-700 rounded-full h-1.5 mb-4 max-w-xs mx-auto">
              <div className="bg-amber-500 h-1.5 rounded-full transition-all" style={{ width: `${(timeLeft / 60) * 100}%` }} />
            </div>
            <button onClick={refreshQR} className="flex items-center gap-2 mx-auto px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 text-sm font-medium transition-all">
              <RefreshCw className="w-4 h-4" /> Generate New QR
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center">
          <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <QrCode className="w-8 h-8 text-indigo-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Connect WhatsApp</h2>
          <p className="text-sm text-slate-400 mb-6">Generate QR to link your WhatsApp business</p>
          <button onClick={() => restartSession('autozap-admin')} className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 font-semibold text-sm transition-all">
            Generate Live QR
          </button>
        </div>
      )}
    </div>
  );
}

export function AdminLiveQR() {
  return (
    <SocketProvider sessionId="autozap-admin">
      <LiveQRContent />
    </SocketProvider>
  );
}
