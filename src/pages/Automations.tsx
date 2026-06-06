import React, { useState, useEffect } from 'react';
import { 
  Send, 
  Mail,
  CheckCircle2,
  Loader2,
  Zap,
  Megaphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { API_URL } from '../config';

export function Automations() {
  const [broadcastText, setBroadcastText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const [settings, setSettings] = useState({
    companyName: 'AutoZap Salon',
    currency: 'Rs.',
    language: 'Urdu/English',
    morningBriefingEnabled: true,
    finalCallEnabled: true,
    lastChanceEnabled: true
  });

  // Fetch settings & WhatsApp status on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch(`${API_URL}/api/settings`);
        if (res.ok) {
          const data = await res.json();
          setSettings(prev => ({ ...prev, ...data }));
        }
      } catch (err) {
        console.error('Failed to fetch settings:', err);
      }
    };

    const checkConnection = async () => {
      try {
        const res = await fetch(`${API_URL}/api/stats`);
        if (res.ok) {
          const data = await res.json();
          setIsConnected(data.activeSessions > 0);
        }
      } catch {
        setIsConnected(false);
      }
    };

    fetchSettings();
    checkConnection();

    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = async (key: 'morningBriefingEnabled' | 'finalCallEnabled' | 'lastChanceEnabled') => {
    const updatedSettings = {
      ...settings,
      [key]: !settings[key]
    };
    
    // Optimistic UI update
    setSettings(updatedSettings);

    try {
      await fetch(`${API_URL}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings)
      });
    } catch (err) {
      console.error('Failed to update settings:', err);
      // Revert if error
      setSettings(settings);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastText) return;
    setSendingBroadcast(true);
    setSuccessCount(null);
    try {
      const res = await fetch(`${API_URL}/api/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: broadcastText })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessCount(data.sentCount);
        setBroadcastText('');
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('Failed to send broadcast', error);
      alert('Failed to send broadcast');
    }
    setSendingBroadcast(false);
  };

  const isAnyAutomationActive = settings.morningBriefingEnabled || settings.finalCallEnabled || settings.lastChanceEnabled;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="text-center space-y-4 mb-12">
        <div className="w-16 h-16 bg-indigo-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 shadow-inner">
          <Megaphone className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Mass Marketing & Broadcast</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Send announcements, discounts, and alerts to all your CRM contacts instantly.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden">
          <div className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 p-6 flex items-center gap-4">
            <Mail className="w-6 h-6 text-indigo-600" />
            <h3 className="font-bold text-lg">Compose Broadcast Message</h3>
          </div>
          
          <form onSubmit={handleSendBroadcast} className="p-8 space-y-6">
            <AnimatePresence>
              {successCount !== null && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 rounded-xl flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-emerald-850 dark:text-emerald-400">Broadcast Sent Successfully!</h4>
                    <p className="text-sm text-emerald-600 mt-1">Sent to {successCount} customers.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Message Content</label>
              <textarea 
                value={broadcastText}
                onChange={(e) => setBroadcastText(e.target.value)}
                placeholder="Hi {Name}! Discount this weekend..."
                className="w-full h-40 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all resize-none text-[15px] leading-relaxed"
                required
              />
            </div>

            <button type="submit" disabled={sendingBroadcast || !broadcastText || !isConnected} className="w-full flex items-center justify-center gap-2 px-8 py-3.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg font-bold active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
              {sendingBroadcast ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              {isConnected ? 'Blast Message' : 'WhatsApp Offline'}
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <Zap className="w-6 h-6 text-amber-500" />
              <h3 className="font-bold text-lg">Smart Reminders (Auto-Mission)</h3>
            </div>
            <div className="space-y-4">
              {/* Morning Briefing */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/50 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Morning Briefing</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400">8:00 AM</span>
                    <button
                      type="button"
                      onClick={() => handleToggle('morningBriefingEnabled')}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${settings.morningBriefingEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings.morningBriefingEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>
                <p className="text-sm font-bold">Today's Appointment Reminder</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Sends a "Good Morning" message to every customer booked for today.</p>
              </div>

              {/* Final Call */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/50 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Final Call</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400">-30 Minutes</span>
                    <button
                      type="button"
                      onClick={() => handleToggle('finalCallEnabled')}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${settings.finalCallEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings.finalCallEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>
                <p className="text-sm font-bold">Arriving Soon Alert</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Reminds customers their turn is starting in 30 minutes.</p>
              </div>

              {/* Last Chance */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/50 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Last Chance</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400">-5 Minutes</span>
                    <button
                      type="button"
                      onClick={() => handleToggle('lastChanceEnabled')}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${settings.lastChanceEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings.lastChanceEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>
                <p className="text-sm font-bold">Turn Starting Now!</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Sends a high-priority alert when there are only 5 mins left.</p>
              </div>
            </div>

            <div className={`mt-8 p-4 rounded-2xl text-white transition-all ${isConnected && isAnyAutomationActive ? 'bg-indigo-600 shadow-lg shadow-indigo-100/50' : 'bg-rose-600 shadow-lg shadow-rose-100/50'}`}>
              <p className="text-xs font-bold opacity-80 uppercase tracking-widest mb-1">System Status</p>
              <h4 className="text-lg font-black">
                {!isConnected 
                  ? 'WhatsApp Disconnected ❌' 
                  : isAnyAutomationActive 
                    ? 'All Automations Active ✅' 
                    : 'All Automations Paused ⏸️'}
              </h4>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
