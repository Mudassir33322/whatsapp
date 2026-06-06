import { useState, useEffect } from 'react';
import { Clock, LogIn, LogOut, KeyRound, Loader2, CheckCircle2, Fingerprint, History } from 'lucide-react';
import { authHeaders } from './api';

interface Barber { id: number; name: string; pin_code: string; }
interface AttendanceRecord { id: number; barber_id: number; barber_name: string; clock_in: string; clock_out: string | null; status: string; date: string; }

export function SalonAttendance() {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedBarber, setSelectedBarber] = useState('');
  const [pin, setPin] = useState('');
  const [action, setAction] = useState<'in' | 'out'>('in');
  const [submitting, setSubmitting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const fetchAll = async () => {
    try {
      const [b, a, h] = await Promise.all([
        fetch('/api/salon/barbers', { headers: authHeaders() }).then((r) => r.json()),
        fetch('/api/salon/attendance/today', { headers: authHeaders() }).then((r) => r.json()),
        fetch('/api/salon/attendance/history?days=7', { headers: authHeaders() }).then((r) => r.json())
      ]);
      setBarbers(b);
      setAttendance(a);
      setHistory(h);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const submitAttendance = async () => {
    if (!selectedBarber || !pin) { setError('Select barber and enter PIN'); return; }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const endpoint = action === 'in' ? '/api/salon/attendance/clockin' : '/api/salon/attendance/clockout';
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ barber_id: Number(selectedBarber), pin_code: pin })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed');
      setSuccess(data.message || (action === 'in' ? 'Clocked in!' : 'Clocked out!'));
      setPin('');
      await fetchAll();
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  const fmtTime = (d: string) => d ? new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—';

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Barber Attendance</h1>
          <p className="text-sm text-slate-500 mt-1">Clock in/out using PIN code</p>
        </div>
        <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all text-sm font-semibold">
          <History className="w-4 h-4" /> {showHistory ? 'Today' : 'History'}
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-rose-50 text-rose-600 rounded-xl text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 text-green-600 rounded-xl text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {success}</div>}

      {!showHistory ? (
        <>
          {/* Clock In/Out Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
            <h2 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Fingerprint className="w-5 h-5 text-indigo-500" />
              {action === 'in' ? 'Clock In' : 'Clock Out'}
            </h2>
            <div className="space-y-3">
              <div className="flex gap-2 mb-2">
                <button onClick={() => setAction('in')} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${action === 'in' ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}>
                  <LogIn className="w-4 h-4 inline mr-1" /> Clock In
                </button>
                <button onClick={() => setAction('out')} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${action === 'out' ? 'bg-rose-100 text-rose-700 border border-rose-300' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}>
                  <LogOut className="w-4 h-4 inline mr-1" /> Clock Out
                </button>
              </div>
              <select value={selectedBarber} onChange={(e) => setSelectedBarber(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white">
                <option value="">Select barber...</option>
                {barbers.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} {b.pin_code ? '(PIN: ' + b.pin_code + ')' : '(no PIN)'}</option>
                ))}
              </select>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="password" maxLength={4} placeholder="Enter 4-digit PIN" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
              </div>
              <button onClick={submitAttendance} disabled={submitting} className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold text-sm transition-all disabled:opacity-50">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                {submitting ? 'Processing...' : action === 'in' ? 'Clock In' : 'Clock Out'}
              </button>
            </div>
          </div>

          {/* Today's Attendance */}
          <div>
            <h2 className="font-semibold text-slate-700 mb-3">Today's Attendance ({attendance.length})</h2>
            {attendance.length === 0 ? (
              <div className="text-center py-8 text-slate-400 bg-white rounded-xl border border-slate-200">
                <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No one clocked in today yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {attendance.map((a) => (
                  <div key={a.id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${a.status === 'clocked_in' ? 'bg-green-100' : 'bg-slate-100'}`}>
                        {a.status === 'clocked_in' ? <LogIn className="w-4 h-4 text-green-600" /> : <LogOut className="w-4 h-4 text-slate-400" />}
                      </div>
                      <div>
                        <p className="font-medium text-slate-700 text-sm">{a.barber_name}</p>
                        <p className="text-xs text-slate-400">
                          In: {fmtTime(a.clock_in)}
                          {a.clock_out && <span className="ml-2">Out: {fmtTime(a.clock_out)}</span>}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${a.status === 'clocked_in' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {a.status === 'clocked_in' ? 'Active' : 'Done'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div>
          <h2 className="font-semibold text-slate-700 mb-3">Last 7 Days</h2>
          {history.length === 0 ? (
            <div className="text-center py-8 text-slate-400 bg-white rounded-xl border border-slate-200">
              <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No attendance history</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left p-3 font-semibold text-slate-600">Barber</th>
                    <th className="text-left p-3 font-semibold text-slate-600">Date</th>
                    <th className="text-left p-3 font-semibold text-slate-600">In</th>
                    <th className="text-left p-3 font-semibold text-slate-600">Out</th>
                    <th className="text-left p-3 font-semibold text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="p-3 font-medium text-slate-700">{a.barber_name}</td>
                      <td className="p-3 text-slate-500">{new Date(a.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                      <td className="p-3 text-slate-500">{fmtTime(a.clock_in)}</td>
                      <td className="p-3 text-slate-500">{a.clock_out ? fmtTime(a.clock_out) : '—'}</td>
                      <td className="p-3">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${a.status === 'clocked_in' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {a.status === 'clocked_in' ? 'Active' : 'Completed'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
