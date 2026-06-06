import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  QrCode, 
  RefreshCcw, 
  ShieldCheck, 
  Smartphone, 
  Monitor, 
  Link,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Zap,
  Settings,
  Send,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { SendMessageModal } from '../components/SendMessageModal';
import QRCode from 'qrcode';

export function LiveQR() {
  const { user } = useAuth();
  const sessionId = user?.uid || '';
  const { status, initSession, deleteSession, sendMessage } = useSocket(sessionId);
  const [qrImageUrl, setQrImageUrl] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState(60);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const initTriggered = useRef(false);

  useEffect(() => {
    if (!status) return;
    if (status.status === 'DISCONNECTED' || status.status === 'RECONNECTING') {
      if (!initTriggered.current) {
        initTriggered.current = true;
        initSession(sessionId);
      }
    } else {
      initTriggered.current = false;
    }
  }, [status?.status]);

  useEffect(() => {
    if (status?.qr) {
      QRCode.toDataURL(status.qr, {
        width: 300,
        margin: 2,
        color: {
          dark: '#1e293b',
          light: '#ffffff',
        },
      }).then(url => setQrImageUrl(url));
      setTimeLeft(60);
    }
  }, [status?.qr]);

  useEffect(() => {
    if (status?.status === 'QR_READY' && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft, status?.status]);

  const handleInit = () => {
    initSession(sessionId);
  };

  const handleReset = async () => {
    try {
      // Clear client-side state
      setQrImageUrl('');
      
      // Call standard delete via socket (memory cleanup)
      deleteSession(sessionId);

      // Force hard reset via API (file system cleanup)
      await fetch('/api/sessions/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });

      console.log('Session hard reset complete');
      
      // Auto-reinitiate after a short delay
      setTimeout(() => handleInit(), 1000);
    } catch (err) {
      console.error('Failed to reset session:', err);
    }
  };

  const handleSendMessage = (to: string, message: string) => {
    sendMessage(sessionId, to, message);
    setSendingTo(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {sendingTo !== null && (
        <SendMessageModal 
          initialPhone={sendingTo}
          onClose={() => setSendingTo(null)} 
          onSend={handleSendMessage} 
        />
      )}
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight">Remote QR Sync</h2>
        <p className="text-slate-500 mt-2">Connect your WhatsApp instance securely across any device.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        {/* Connection Tool */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl shadow-indigo-50/50 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-600" />
          
          <div className="flex flex-col items-center justify-center min-h-[400px]">
             {!status && (
               <div className="text-center space-y-6">
                 <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto text-indigo-600">
                   <QrCode className="w-10 h-10" />
                 </div>
                 <div className="space-y-2">
                   <h3 className="text-xl font-bold text-slate-800">Ready to Connect?</h3>
                   <p className="text-slate-500 text-sm max-w-xs">Launch a new virtual WhatsApp session and generate your secure pairing QR.</p>
                 </div>
                 <button 
                  onClick={handleInit}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
                >
                   Generate Live QR
                 </button>
               </div>
             )}

             {status?.status === 'CONNECTING' && (
               <div className="text-center space-y-4">
                 <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto" />
                 <p className="text-slate-600 font-medium animate-pulse">Launching virtual browser...</p>
                 <div className="pt-4 space-y-2">
                   <button 
                    onClick={handleReset}
                    className="text-xs text-indigo-400 hover:text-indigo-600 font-bold uppercase tracking-widest block mx-auto underline"
                   >
                     Stuck? Force Reset
                   </button>
                   <p className="text-[10px] text-slate-400 italic">This will wipe all session data and start fresh.</p>
                 </div>
               </div>
             )}

             {status?.status === 'QR_READY' && (
               <div className="space-y-6 flex flex-col items-center">
                 <div className="relative p-2 bg-white rounded-2xl shadow-inner border border-slate-100 ring-8 ring-slate-50">
                   {qrImageUrl ? (
                     <div className="relative">
                        <motion.img 
                          initial={{ opacity: 0, scale: 0.9 }} 
                          animate={{ opacity: 1, scale: 1 }}
                          src={qrImageUrl} 
                          className={`w-64 h-64 rounded-lg transition-opacity ${timeLeft < 5 ? 'opacity-30' : 'opacity-100'}`} 
                        />
                        {timeLeft < 5 && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <RefreshCcw className="w-12 h-12 text-indigo-600 animate-spin" />
                          </div>
                        )}
                     </div>
                   ) : (
                     <div className="w-64 h-64 bg-slate-50 flex items-center justify-center">
                       <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                     </div>
                   )}
                   <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
                      <Zap className="w-32 h-32 text-indigo-600" />
                   </div>
                 </div>

                 <div className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${timeLeft < 10 ? 'bg-rose-50 border-rose-200 animate-pulse' : 'bg-slate-50 border-slate-200'}`}>
                    <RefreshCcw className={`w-3 h-3 ${timeLeft < 10 ? 'text-rose-500' : 'text-slate-400'}`} />
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${timeLeft < 10 ? 'text-rose-600' : 'text-slate-500'}`}>
                      {timeLeft < 5 ? 'Refreshing QR...' : `Expires in ${timeLeft}s`}
                    </span>
                 </div>
                 
                 <p className="text-[10px] text-slate-400 font-medium text-center max-w-[200px]">
                   Scan quickly! The code refreshes frequently for security.
                 </p>
               </div>
             )}

             {status?.status === 'ERROR' && (
               <div className="text-center space-y-6">
                 <div className="w-20 h-20 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto text-rose-600 shadow-inner">
                   <AlertCircle className="w-10 h-10" />
                 </div>
                 <div className="space-y-2">
                   <h3 className="text-xl font-bold text-slate-800">Connection Failed</h3>
                   <p className="text-slate-500 text-sm max-w-xs mx-auto">
                     We encountered an issue while initializing your session.
                   </p>
                   {status.message && (
                     <p className="text-[10px] font-mono text-rose-400 bg-rose-50/50 p-2 rounded-lg mt-2 truncate max-w-xs">{status.message}</p>
                   )}
                 </div>
                 <div className="flex flex-col gap-3">
                   <button 
                    onClick={handleInit}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg active:scale-95"
                  >
                     Retry Connection
                   </button>
                   <button 
                    onClick={handleReset}
                    className="text-xs text-rose-400 hover:text-rose-600 font-bold uppercase tracking-widest block mx-auto underline"
                   >
                     Hard Reset & Wipe Data
                   </button>
                 </div>
               </div>
             )}

             {status?.status === 'CONNECTED' && (
               <motion.div 
                 initial={{ scale: 0.9, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 className="text-center space-y-6"
               >
                 <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600 border-4 border-emerald-100">
                   <CheckCircle2 className="w-12 h-12" />
                 </div>
                 <div className="space-y-1">
                   <h3 className="text-2xl font-bold text-emerald-700">Perfectly Linked</h3>
                   <p className="text-slate-500 text-sm">Your enterprise session is active and syncing.</p>
                   {status.user && (
                     <p className="text-xs font-mono text-slateald-400 mt-1">+{status.user}</p>
                   )}
                 </div>
                 <div className="grid grid-cols-2 gap-4 mt-8">
                   <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                      <p className="text-[10px] uppercase font-bold text-emerald-600 mb-1">Session</p>
                      <p className="text-sm font-bold text-emerald-700">Active ✓</p>
                   </div>
                   <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                      <p className="text-[10px] uppercase font-bold text-emerald-600 mb-1">Status</p>
                      <p className="text-sm font-bold">Online</p>
                   </div>
                 </div>

                 <button 
                   onClick={() => setSendingTo('')}
                   className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-black transition-all shadow-lg flex items-center justify-center gap-2 group"
                 >
                   <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                   Send Test Message
                 </button>
               </motion.div>
             )}

             {(status?.status === 'DISCONNECTED') && (
               <div className="text-center space-y-6">
                 <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                   <X className="w-10 h-10" />
                 </div>
                 <div className="space-y-2">
                   <h3 className="text-xl font-bold text-slate-800">Disconnected</h3>
                   <p className="text-slate-500 text-sm max-w-xs mx-auto">
                     {status.message || 'Session disconnected. Please reconnect.'}
                   </p>
                 </div>
                 <button 
                   onClick={handleInit}
                   className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg active:scale-95"
                 >
                   Reconnect
                 </button>
               </div>
             )}

             {(status?.status === 'RECONNECTING') && (
               <div className="text-center space-y-4">
                 <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto" />
                 <p className="text-slate-600 font-medium">Reconnecting automatically...</p>
                 <p className="text-xs text-slate-400">WhatsApp connection lost. Retrying in 10s.</p>
                 <button 
                   onClick={handleReset}
                   className="text-xs text-rose-400 hover:text-rose-600 font-bold uppercase tracking-widest block mx-auto underline"
                 >
                   Force Reset
                 </button>
               </div>
             )}
          </div>
        </div>

        {/* Instructions */}
        <div className="space-y-6">
          <h3 className="text-xl font-bold">How to pair remotely</h3>
          <div className="space-y-4">
            <InstructionStep 
              num="01" 
              title="Open WhatsApp" 
              desc="Open WhatsApp on your mobile device or another web client."
              icon={Smartphone}
            />
            <InstructionStep 
              num="02" 
              title="Navigate to Settings" 
              desc="Tap Menu or Settings and select Linked Devices."
              icon={Settings}
            />
            <InstructionStep 
              num="03" 
              title="Scan QR Code" 
              desc="Point your device camera at the generated code on this screen."
              icon={QrCode}
            />
            <InstructionStep 
              num="04" 
              title="Instant Sync" 
              desc="The dashboard will update instantly upon successful pairing."
              icon={Link}
            />
          </div>

          <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100 flex gap-4">
            <ShieldCheck className="w-6 h-6 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800 font-medium">
              Enterprise security: All session data is hardware-isolated and encrypted. We never store your messages or media.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function InstructionStep({ num, title, desc, icon: Icon }: any) {
  return (
    <div className="flex gap-4 group">
      <div className="flex flex-col items-center">
        <div className="w-10 h-10 bg-white border-2 border-indigo-100 rounded-full flex items-center justify-center text-sm font-black text-indigo-600 group-hover:border-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
          {num}
        </div>
        <div className="flex-1 w-0.5 bg-indigo-50 my-1 group-last:hidden" />
      </div>
      <div className="pb-6">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="w-4 h-4 text-slate-400" />
          <h4 className="font-bold text-slate-800">{title}</h4>
        </div>
        <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}


