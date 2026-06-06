import { useState, useEffect } from 'react';
import { Store, Save, Lock, Bell, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { authHeaders } from './api';

interface SalonSettingsData {
  name: string; owner_name: string; phone: string; address: string;
  description: string; cover_image: string; logo: string; latitude: string; longitude: string;
}

const DF: SalonSettingsData = { name: '', owner_name: '', phone: '', address: '', description: '', cover_image: '', logo: '', latitude: '', longitude: '' };

export function SalonSettings() {
  const [tab, setTab] = useState<'profile' | 'password' | 'notifications'>('profile');
  const [form, setForm] = useState<SalonSettingsData>(DF);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '' });
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [notifPrefs, setNotifPrefs] = useState({ reminder_30min: true, queue_update: true, review_request: true, re_engagement: true });
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSuccess, setNotifSuccess] = useState('');

  const fetchSettings = async () => {
    try {
      const r = await fetch('/api/salon/settings', { headers: authHeaders() });
      if (!r.ok) throw new Error('Failed to fetch settings');
      const data = await r.json();
      setForm({ ...DF, ...data });
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSettings(); }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/salon/notification-preferences', { headers: authHeaders() });
        if (r.ok) { const data = await r.json(); setNotifPrefs(data); }
      } catch (_) {}
      finally { setNotifLoading(false); }
    })();
  }, []);

  const saveNotifPrefs = async () => {
    setNotifSaving(true); setNotifSuccess('');
    try {
      const r = await fetch('/api/salon/notification-preferences', { method: 'PUT', headers: authHeaders(), body: JSON.stringify(notifPrefs) });
      if (r.ok) setNotifSuccess('Notification preferences saved');
    } catch (_) {}
    finally { setNotifSaving(false); }
  };

  const saveProfile = async () => {
    setSaving(true); setError(''); setSuccess('');
    try {
      const r = await fetch('/api/salon/settings', { method: 'PUT', headers: authHeaders(), body: JSON.stringify(form) });
      if (!r.ok) throw new Error('Failed to save');
      setSuccess('Settings saved successfully');
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const savePassword = async () => {
    setSavingPwd(true); setPwdError(''); setPwdSuccess('');
    if (!pwd.currentPassword || !pwd.newPassword) { setPwdError('Both fields are required'); setSavingPwd(false); return; }
    try {
      const r = await fetch('/api/salon/auth/update-password', { method: 'POST', headers: authHeaders(), body: JSON.stringify(pwd) });
      if (!r.ok) throw new Error('Failed to update password');
      setPwdSuccess('Password updated successfully');
      setPwd({ currentPassword: '', newPassword: '' });
    } catch (e: any) { setPwdError(e.message); }
    finally { setSavingPwd(false); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Store className="w-6 h-6 text-indigo-600" /> Salon Settings</h1>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button onClick={() => setTab('profile')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'profile' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Profile</button>
        <button onClick={() => setTab('password')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'password' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Password</button>
        <button onClick={() => setTab('notifications')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'notifications' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Notifications</button>
      </div>

      {tab === 'profile' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
          {error && <div className="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-xl border border-red-200 text-sm"><XCircle className="w-4 h-4 shrink-0" />{error}</div>}
          {success && <div className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-3 rounded-xl border border-green-200 text-sm"><CheckCircle className="w-4 h-4 shrink-0" />{success}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Salon Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" /></div>
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Owner Name</label>
              <input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" /></div>
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" /></div>
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Address</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" /></div>
            <div className="md:col-span-2"><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" /></div>
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Cover Image URL</label>
              <input value={form.cover_image} onChange={(e) => setForm({ ...form, cover_image: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" placeholder="https://..." /></div>
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Logo URL</label>
              <input value={form.logo} onChange={(e) => setForm({ ...form, logo: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" placeholder="https://..." /></div>
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Latitude</label>
              <input value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" /></div>
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Longitude</label>
              <input value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" /></div>
          </div>

          <div className="flex justify-end pt-2">
            <button onClick={saveProfile} disabled={saving} className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-colors inline-flex items-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save Changes
            </button>
          </div>
        </div>
      )}

      {tab === 'password' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
          <div className="flex items-center gap-2 text-gray-900 font-semibold"><Lock className="w-5 h-5 text-indigo-600" /> Update Password</div>
          {pwdError && <div className="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-xl border border-red-200 text-sm"><XCircle className="w-4 h-4 shrink-0" />{pwdError}</div>}
          {pwdSuccess && <div className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-3 rounded-xl border border-green-200 text-sm"><CheckCircle className="w-4 h-4 shrink-0" />{pwdSuccess}</div>}
          <div className="space-y-4 max-w-md">
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Current Password</label>
              <input type="password" value={pwd.currentPassword} onChange={(e) => setPwd({ ...pwd, currentPassword: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" /></div>
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">New Password</label>
              <input type="password" value={pwd.newPassword} onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" /></div>
          </div>
          <div className="flex justify-end pt-2">
            <button onClick={savePassword} disabled={savingPwd} className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-colors inline-flex items-center gap-2">
              {savingPwd ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Update Password
            </button>
          </div>
        </div>
      )}

      {tab === 'notifications' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
          <div className="flex items-center gap-2 text-gray-900 font-semibold"><Bell className="w-5 h-5 text-indigo-600" /> Notification Preferences</div>
          {notifSuccess && <div className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-3 rounded-xl border border-green-200 text-sm"><CheckCircle className="w-4 h-4 shrink-0" />{notifSuccess}</div>}

          {notifLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
          ) : (
            <div className="space-y-4 max-w-lg">
              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer">
                <div><p className="font-medium text-gray-900">30-min Reminder</p><p className="text-xs text-gray-500 mt-0.5">Appointment se 30 min pehle reminder bhejein</p></div>
                <input type="checkbox" checked={notifPrefs.reminder_30min} onChange={e => setNotifPrefs({ ...notifPrefs, reminder_30min: e.target.checked })} className="w-5 h-5 rounded accent-indigo-600" />
              </label>
              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer">
                <div><p className="font-medium text-gray-900">Queue Update</p><p className="text-xs text-gray-500 mt-0.5">Jab 2 ya kam customers baqi hon to inform karein</p></div>
                <input type="checkbox" checked={notifPrefs.queue_update} onChange={e => setNotifPrefs({ ...notifPrefs, queue_update: e.target.checked })} className="w-5 h-5 rounded accent-indigo-600" />
              </label>
              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer">
                <div><p className="font-medium text-gray-900">Review Request</p><p className="text-xs text-gray-500 mt-0.5">Service complete hone par rating ka message bhejein</p></div>
                <input type="checkbox" checked={notifPrefs.review_request} onChange={e => setNotifPrefs({ ...notifPrefs, review_request: e.target.checked })} className="w-5 h-5 rounded accent-indigo-600" />
              </label>
              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer">
                <div><p className="font-medium text-gray-900">Re-engagement</p><p className="text-xs text-gray-500 mt-0.5">30 din baad dobara aane ka message bhejein</p></div>
                <input type="checkbox" checked={notifPrefs.re_engagement} onChange={e => setNotifPrefs({ ...notifPrefs, re_engagement: e.target.checked })} className="w-5 h-5 rounded accent-indigo-600" />
              </label>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button onClick={saveNotifPrefs} disabled={notifSaving} className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-colors inline-flex items-center gap-2">
              {notifSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save Preferences
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
