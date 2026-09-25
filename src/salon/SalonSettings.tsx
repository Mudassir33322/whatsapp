import { useState, useEffect } from 'react';
import { Store, Save, Lock, Bell, Database, AlertTriangle, CheckCircle, XCircle, Loader2, Upload, Clock, ShoppingBag } from 'lucide-react';
import { salonFetch } from './api';
import { API_URL } from '../config';
import { mediaUrl } from '../lib/mediaUrl';

interface SalonSettingsData {
  name: string; owner_name: string; phone: string; owner_phone: string; address: string;
  description: string; cover_image: string; logo: string; latitude: string; longitude: string;
}

const DF: SalonSettingsData = { name: '', owner_name: '', phone: '', owner_phone: '', address: '', description: '', cover_image: '', logo: '', latitude: '', longitude: '' };

export function SalonSettings() {
  const [tab, setTab] = useState<'profile' | 'shop' | 'password' | 'notifications' | 'hours' | 'database'>('profile');
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

  const [uploadingImage, setUploadingImage] = useState(false);

  const [shop, setShop] = useState({ company_name: '', currency: 'Rs.', language: 'Urdu/English', address: '', map_url: '' });
  const [shopLoading, setShopLoading] = useState(true);
  const [shopSaving, setShopSaving] = useState(false);
  const [shopError, setShopError] = useState('');
  const [shopSuccess, setShopSuccess] = useState('');

  const fetchShop = async (signal?: AbortSignal) => {
    try {
      const r = await salonFetch('/api/salon/shop/settings', { signal });
      if (r.ok) {
        const data = await r.json();
        setShop({ company_name: data.company_name || '', currency: data.currency || 'Rs.', language: data.language || 'Urdu/English', address: data.address || '', map_url: data.map_url || '' });
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
    } finally { setShopLoading(false); }
  };

  const saveShop = async () => {
    setShopSaving(true); setShopError(''); setShopSuccess('');
    try {
      const r = await salonFetch('/api/salon/shop/settings', {
        method: 'PUT',
        body: JSON.stringify(shop),
      });
      if (!r.ok) throw new Error('Failed to save');
      setShopSuccess('Shop settings saved successfully');
    } catch (e: any) { setShopError(e.message); }
    finally { setShopSaving(false); }
  };

  const fetchSettings = async (signal?: AbortSignal) => {
    try {
      const r = await salonFetch('/api/salon/settings', { signal });
      if (!r.ok) throw new Error('Failed to fetch settings');
      const data = await r.json();
      setForm({ ...DF, ...data });
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setError(e.message);
    }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const ac = new AbortController();
    fetchSettings(ac.signal);
    fetchShop(ac.signal);
    return () => ac.abort();
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const r = await salonFetch('/api/salon/notification-preferences', { signal: ac.signal });
        if (r.ok) { const data = await r.json(); setNotifPrefs(data); }
      } catch (_) {}
      finally { setNotifLoading(false); }
    })();
    return () => ac.abort();
  }, []);

  const saveNotifPrefs = async () => {
    setNotifSaving(true); setNotifSuccess('');
    try {
      const r = await salonFetch('/api/salon/notification-preferences', { method: 'PUT', body: JSON.stringify(notifPrefs) });
      if (r.ok) setNotifSuccess('Notification preferences saved');
    } catch (_) {}
    finally { setNotifSaving(false); }
  };

  const saveProfile = async () => {
    setSaving(true); setError(''); setSuccess('');
    try {
      const r = await salonFetch('/api/salon/settings', { method: 'PUT', body: JSON.stringify(form) });
      if (!r.ok) throw new Error('Failed to save');
      setSuccess('Settings saved successfully');
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const savePassword = async () => {
    setSavingPwd(true); setPwdError(''); setPwdSuccess('');
    if (!pwd.currentPassword || !pwd.newPassword) { setPwdError('Both fields are required'); setSavingPwd(false); return; }
    try {
      const r = await salonFetch('/api/salon/auth/update-password', { method: 'POST', body: JSON.stringify(pwd) });
      if (!r.ok) throw new Error('Failed to update password');
      setPwdSuccess('Password updated successfully');
      setPwd({ currentPassword: '', newPassword: '' });
    } catch (e: any) { setPwdError(e.message); }
    finally { setSavingPwd(false); }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'logo' | 'cover_image') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const token = localStorage.getItem('salon-token');
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch(`${API_URL}/api/salon/media/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const data = await res.json();
      if (data.success) {
        const saveRes = await salonFetch('/api/salon/settings', {
          method: 'PUT',
          body: JSON.stringify({ [field]: data.url }),
        });
        if (!saveRes.ok) throw new Error('Failed to save image URL');
        setForm(prev => ({ ...prev, [field]: data.url }));
      } else {
        setError('Upload failed');
      }
    } catch { setError('Upload failed'); }
    finally { setUploadingImage(false); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-amber-600" /></div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Store className="w-6 h-6 text-amber-600" /> Salon Settings</h1>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button type="button" onClick={() => setTab('profile')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'profile' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Profile</button>
        <button type="button" onClick={() => setTab('shop')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'shop' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Shop</button>
        <button type="button" onClick={() => setTab('password')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'password' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Password</button>
        <button type="button" onClick={() => setTab('notifications')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'notifications' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Notifications</button>
        <button type="button" onClick={() => setTab('hours')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'hours' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Working Hours</button>
        <button type="button" onClick={() => setTab('database')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'database' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Database</button>
      </div>

      {tab === 'profile' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
          {error && <div className="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-xl border border-red-200 text-sm"><XCircle className="w-4 h-4 shrink-0" />{error}</div>}
          {success && <div className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-3 rounded-xl border border-green-200 text-sm"><CheckCircle className="w-4 h-4 shrink-0" />{success}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Salon Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent" /></div>
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Owner Name</label>
              <input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent" /></div>
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent" /></div>
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Owner Phone</label>
              <input value={form.owner_phone} onChange={(e) => setForm({ ...form, owner_phone: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent" /></div>
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Address</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent" /></div>
            <div className="md:col-span-2"><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent" /></div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Cover Image</label>
              <label className={`flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${form.cover_image ? 'border-amber-400 bg-amber-50/30' : 'border-gray-300 hover:border-amber-400 hover:bg-amber-50/20'}`}>
                {form.cover_image ? (
                  <img src={mediaUrl(form.cover_image)} alt="Cover" className="h-full object-contain p-2" />
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-gray-400">
                    <Upload className="w-6 h-6" />
                    <span className="text-xs font-medium">{uploadingImage ? 'Uploading...' : 'Click to upload cover'}</span>
                  </div>
                )}
                <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'cover_image')} className="hidden" />
              </label>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Logo</label>
              <label className={`flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${form.logo ? 'border-amber-400 bg-amber-50/30' : 'border-gray-300 hover:border-amber-400 hover:bg-amber-50/20'}`}>
                {form.logo ? (
                  <img src={mediaUrl(form.logo)} alt="Logo" className="h-full object-contain p-2" />
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-gray-400">
                    <Upload className="w-6 h-6" />
                    <span className="text-xs font-medium">{uploadingImage ? 'Uploading...' : 'Click to upload logo'}</span>
                  </div>
                )}
                <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'logo')} className="hidden" />
              </label>
            </div>
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Latitude</label>
              <input value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent" /></div>
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Longitude</label>
              <input value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent" /></div>
          </div>

          <div className="flex justify-end pt-2">
            <button type="button" onClick={saveProfile} disabled={saving} className="px-5 py-2.5 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-xl transition-colors inline-flex items-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save Changes
            </button>
          </div>
        </div>
      )}

      {tab === 'shop' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
          <div className="flex items-center gap-2 text-gray-900 font-semibold"><ShoppingBag className="w-5 h-5 text-amber-600" /> Shop Settings</div>
          {shopError && <div className="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-xl border border-red-200 text-sm"><XCircle className="w-4 h-4 shrink-0" />{shopError}</div>}
          {shopSuccess && <div className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-3 rounded-xl border border-green-200 text-sm"><CheckCircle className="w-4 h-4 shrink-0" />{shopSuccess}</div>}
          {shopLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-amber-600" /></div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Company Name</label>
                  <input value={shop.company_name} onChange={(e) => setShop({ ...shop, company_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" /></div>
                <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Currency</label>
                  <input value={shop.currency} onChange={(e) => setShop({ ...shop, currency: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" /></div>
                <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Language</label>
                  <input value={shop.language} onChange={(e) => setShop({ ...shop, language: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" /></div>
                <div className="md:col-span-2"><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Map URL</label>
                  <input value={shop.map_url} onChange={(e) => setShop({ ...shop, map_url: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" /></div>
              </div>
              <div className="flex justify-end pt-2">
                <button type="button" onClick={saveShop} disabled={shopSaving}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-xl transition-colors inline-flex items-center gap-2">
                  {shopSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Shop Settings
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'password' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
          <div className="flex items-center gap-2 text-gray-900 font-semibold"><Lock className="w-5 h-5 text-amber-600" /> Update Password</div>
          {pwdError && <div className="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-xl border border-red-200 text-sm"><XCircle className="w-4 h-4 shrink-0" />{pwdError}</div>}
          {pwdSuccess && <div className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-3 rounded-xl border border-green-200 text-sm"><CheckCircle className="w-4 h-4 shrink-0" />{pwdSuccess}</div>}
          <div className="space-y-4 max-w-md">
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Current Password</label>
              <input type="password" value={pwd.currentPassword} onChange={(e) => setPwd({ ...pwd, currentPassword: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent" /></div>
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">New Password</label>
              <input type="password" value={pwd.newPassword} onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent" /></div>
          </div>
          <div className="flex justify-end pt-2">
            <button type="button" onClick={savePassword} disabled={savingPwd} className="px-5 py-2.5 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-xl transition-colors inline-flex items-center gap-2">
              {savingPwd ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Update Password
            </button>
          </div>
        </div>
      )}

      {tab === 'notifications' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
          <div className="flex items-center gap-2 text-gray-900 font-semibold"><Bell className="w-5 h-5 text-amber-600" /> Notification Preferences</div>
          {notifSuccess && <div className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-3 rounded-xl border border-green-200 text-sm"><CheckCircle className="w-4 h-4 shrink-0" />{notifSuccess}</div>}

          {notifLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-amber-600" /></div>
          ) : (
            <div className="space-y-4 max-w-lg">
              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer">
                <div><p className="font-medium text-gray-900">30-min Reminder</p><p className="text-xs text-gray-500 mt-0.5">Appointment se 30 min pehle reminder bhejein</p></div>
                <input type="checkbox" checked={notifPrefs.reminder_30min} onChange={e => setNotifPrefs({ ...notifPrefs, reminder_30min: e.target.checked })} className="w-5 h-5 rounded accent-amber-500" />
              </label>
              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer">
                <div><p className="font-medium text-gray-900">Queue Update</p><p className="text-xs text-gray-500 mt-0.5">Jab 2 ya kam customers baqi hon to inform karein</p></div>
                <input type="checkbox" checked={notifPrefs.queue_update} onChange={e => setNotifPrefs({ ...notifPrefs, queue_update: e.target.checked })} className="w-5 h-5 rounded accent-amber-500" />
              </label>
              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer">
                <div><p className="font-medium text-gray-900">Review Request</p><p className="text-xs text-gray-500 mt-0.5">Service complete hone par rating ka message bhejein</p></div>
                <input type="checkbox" checked={notifPrefs.review_request} onChange={e => setNotifPrefs({ ...notifPrefs, review_request: e.target.checked })} className="w-5 h-5 rounded accent-amber-500" />
              </label>
              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer">
                <div><p className="font-medium text-gray-900">Re-engagement</p><p className="text-xs text-gray-500 mt-0.5">30 din baad dobara aane ka message bhejein</p></div>
                <input type="checkbox" checked={notifPrefs.re_engagement} onChange={e => setNotifPrefs({ ...notifPrefs, re_engagement: e.target.checked })} className="w-5 h-5 rounded accent-amber-500" />
              </label>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button type="button" onClick={saveNotifPrefs} disabled={notifSaving} className="px-5 py-2.5 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-xl transition-colors inline-flex items-center gap-2">
              {notifSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save Preferences
            </button>
          </div>
        </div>
      )}

      {tab === 'hours' && <SalonWorkingHours />}

      {tab === 'database' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
          <div className="flex items-center gap-2 text-gray-900 font-semibold"><Database className="w-5 h-5 text-red-600" /> Database Reset</div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold mb-1">This will permanently delete your salon's:</p>
              <ul className="list-disc list-inside space-y-0.5 text-amber-700">
                <li>All appointments</li>
                <li>Revenue and expense records</li>
                <li>Reviews and notifications</li>
                <li>Barber attendance logs</li>
              </ul>
              <p className="mt-2 font-semibold">Salon settings, barbers, services, and customers will be kept.</p>
            </div>
          </div>

          <SalonDatabaseReset />
        </div>
      )}
    </div>
  );
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function SalonWorkingHours() {
  const [hours, setHours] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  const fetchHours = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const r = await salonFetch('/api/salon/working-hours', { signal });
      if (!r.ok) return;
      const data = await r.json();
      if (Array.isArray(data) && data.length === 7 && data.every((h: any) => 'day_of_week' in h)) {
        setHours(data);
      } else {
        setHours(WEEKDAYS.map((_, i) => {
          const existing = data.find((h: any) => Number(h.day_of_week) === i);
          return existing || { day_of_week: i, start_time: '09:00', end_time: '18:00', is_off: false };
        }));
      }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    const ac = new AbortController();
    fetchHours(ac.signal);
    return () => ac.abort();
  }, []);

  const toggleOff = (i: number) => {
    setHours(prev => prev.map((h, j) => j === i ? { ...h, is_off: !h.is_off } : h));
  };

  const updateField = (i: number, field: string, value: any) => {
    setHours(prev => prev.map((h, j) => j === i ? { ...h, [field]: value } : h));
  };

  const saveHours = async () => {
    setSaving(true); setSuccess('');
    try {
      const r = await salonFetch('/api/salon/working-hours', {
        method: 'PUT',
        body: JSON.stringify({ hours }),
      });
      if (r.ok) setSuccess('Working hours saved successfully');
    } catch {} finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 className="w-8 h-8 animate-spin text-amber-600" /></div>;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
      <div className="flex items-center gap-2 text-gray-900 font-semibold"><Clock className="w-5 h-5 text-amber-600" /> Working Hours</div>
      <p className="text-sm text-gray-500">Set your salon's weekly working hours. These will be used for time slot availability.</p>

      {success && <div className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-3 rounded-xl border border-green-200 text-sm"><CheckCircle className="w-4 h-4 shrink-0" />{success}</div>}

      <div className="space-y-2">
        {hours.map((h, i) => (
          <div key={i} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${h.is_off ? 'bg-red-50 border border-red-100 opacity-70' : 'bg-gray-50 border border-gray-100'}`}>
            <div className="w-24 shrink-0">
              <p className="text-sm font-semibold text-gray-700">{WEEKDAYS[Number(h.day_of_week)]}</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 shrink-0 cursor-pointer">
              <input type="checkbox" checked={!h.is_off} onChange={() => toggleOff(i)}
                className="rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
              Open
            </label>
            <input type="time" value={h.start_time}
              onChange={(e) => updateField(i, 'start_time', e.target.value)}
              disabled={h.is_off}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-40 bg-white" />
            <span className="text-gray-400 text-xs">to</span>
            <input type="time" value={h.end_time}
              onChange={(e) => updateField(i, 'end_time', e.target.value)}
              disabled={h.is_off}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-40 bg-white" />
          </div>
        ))}
      </div>

      <div className="flex justify-end pt-2">
        <button type="button" onClick={saveHours} disabled={saving}
          className="px-5 py-2.5 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-xl transition-all inline-flex items-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Schedule
        </button>
      </div>
    </div>
  );
}

function SalonDatabaseReset() {
  const [resetting, setResetting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [confirmText, setConfirmText] = useState('');

  const handleReset = async () => {
    if (confirmText !== 'RESET') return;
    setResetting(true);
    setResult(null);
    try {
      const res = await salonFetch('/api/salon/database/reset', {
        method: 'POST',
      });
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setResult({ success: false, message: e.message });
    } finally {
      setResetting(false);
      setConfirmText('');
    }
  };

  return (
    <div className="space-y-3">
      {result && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm ${
          result.success
            ? 'bg-green-50 text-green-700 border-green-200'
            : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {result.success ? <CheckCircle className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
          {result.message}
        </div>
      )}

      <p className="text-sm font-medium text-gray-700">
        Type <span className="font-mono font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">RESET</span> to confirm:
      </p>
      <input
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder="Type RESET to confirm"
        className="w-full max-w-xs px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
      />
      <div>
        <button type="button"
          onClick={handleReset}
          disabled={confirmText !== 'RESET' || resetting}
          className="px-5 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors inline-flex items-center gap-2"
        >
          {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
          Reset Salon Data
        </button>
      </div>
    </div>
  );
}
