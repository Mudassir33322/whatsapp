import { useState, useEffect } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { salonFetch } from './api';

interface NotificationLog {
  id: number;
  notification_type?: string;
  customer_phone?: string;
  message_sent?: string;
  text?: string;
  sent_at?: string;
}

export function SalonNotifications() {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const r = await salonFetch('/api/salon/notification-logs', { signal: ac.signal });
        if (r.ok) setLogs(await r.json());
      } catch (e: any) { if (e?.name !== 'AbortError') console.error(e); }
      finally { setLoading(false); }
    })();
    return () => ac.abort();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Bell className="w-6 h-6 text-amber-500" />
            Notification Logs
          </h1>
          <p className="text-sm text-slate-500 mt-1">History of sent notifications</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Type</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Customer</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Message</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Sent At</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-12 text-slate-400 text-sm">No notifications sent yet</td></tr>
            ) :             logs.map((log: NotificationLog, i: number) => (
              <tr key={log.id || i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                    {log.notification_type || 'N/A'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{log.customer_phone || 'N/A'}</td>
                <td className="px-4 py-3 text-sm text-slate-600 max-w-[300px] truncate">{log.message_sent || log.text || ''}</td>
                <td className="px-4 py-3 text-sm text-slate-500 text-right">{log.sent_at ? new Date(log.sent_at).toLocaleString() : 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
