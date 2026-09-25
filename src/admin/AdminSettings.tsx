import { useState, useEffect } from 'react';
import { Settings, AlertTriangle, Database, CheckCircle, XCircle, Loader2, Plus, Pencil, Trash2, X } from 'lucide-react';
import { useAdminAuth } from './AdminAuthContext';
import { useConfirm } from '../hooks/useConfirm';

export function AdminSettings() {
  const { admin, adminFetch } = useAdminAuth();
  const { confirm, confirmDialog } = useConfirm();
  const isSuperAdmin = admin?.role === 'super_admin';
  const [resetting, setResetting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [settings, setSettings] = useState<any[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ setting_key: '', setting_value: '', setting_type: 'string', description: '' });

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const res = await adminFetch('/api/admin/platform-settings', { signal: ac.signal });
        if (res.ok) setSettings(await res.json());
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      } finally { setLoadingSettings(false); }
    })();
    return () => ac.abort();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ setting_key: '', setting_value: '', setting_type: 'string', description: '' });
    setShowModal(true);
  };

  const openEdit = (s: any) => {
    setEditing(s);
    setForm({ setting_key: s.setting_key, setting_value: s.setting_value, setting_type: s.setting_type || 'string', description: s.description || '' });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.setting_key || form.setting_value === undefined) return;
    try {
      const isEdit = !!editing;
      const res = await adminFetch('/api/admin/platform-settings', {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: 'Failed to save setting' }));
        throw new Error(d.error || 'Failed to save setting');
      }
      setShowModal(false);
      const r = await adminFetch('/api/admin/platform-settings');
      if (r.ok) setSettings(await r.json());
    } catch (e: any) { alert(e.message); }
  };

  const del = async (key: string) => {
    const confirmed = await confirm('Delete Setting', `Are you sure you want to delete setting "${key}"?`, 'Delete', 'danger');
    if (!confirmed) return;
    try {
      const res = await adminFetch(`/api/admin/platform-settings/${encodeURIComponent(key)}`, { method: 'DELETE' });
      if (res.ok) setSettings(prev => prev.filter((s: any) => s.setting_key !== key));
    } catch (err) {
      console.error('[AdminSettings] Failed to delete setting:', err);
    }
  };

  const handleReset = async () => {
    if (confirmText !== 'RESET') return;
    setResetting(true);
    setResult(null);
    try {
      const res = await adminFetch('/api/admin/database/reset', {
        method: 'POST',
        body: JSON.stringify({ confirm: 'RESET_ALL_DATA' }),
      });
      const data = await res.json();
      setResult(data);
    } catch (e: any) { setResult({ success: false, message: e.message }); }
    finally { setResetting(false); setConfirmText(''); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {confirmDialog}
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Settings className="w-6 h-6" /> Settings
      </h1>

      {/* Platform Settings */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Settings className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Platform Settings</h2>
              <p className="text-sm text-slate-500">Manage global configuration keys and values</p>
            </div>
          </div>
          {isSuperAdmin && <button type="button" onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-500 transition-all">
            <Plus className="w-4 h-4" /> Add Setting
          </button>}
        </div>

        {loadingSettings ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
        ) : settings.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">No platform settings configured</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Key</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Value</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Description</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase w-20">Actions</th>
                </tr>
              </thead>
              <tbody>
                {settings.map((s: any) => (
                  <tr key={s.id || s.setting_key} className="border-t border-slate-100 hover:bg-slate-50 group">
                    <td className="px-4 py-3 font-mono text-xs text-indigo-600">{s.setting_key}</td>
                    <td className="px-4 py-3 text-slate-700 max-w-[200px] truncate">{s.setting_value}</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded bg-slate-100 text-xs text-slate-600">{s.setting_type}</span></td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{s.description || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      {isSuperAdmin && <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={() => openEdit(s)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
                        <button type="button" onClick={() => del(s.setting_key)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>

      {/* Database Reset — Super Admin Only */}
      {isSuperAdmin && <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
            <Database className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Database Reset</h2>
            <p className="text-sm text-slate-500">Clear all operational data while keeping user accounts and settings</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold mb-1">This will permanently delete:</p>
            <ul className="list-disc list-inside space-y-0.5 text-amber-700">
              <li>All appointments and bookings</li>
              <li>Revenue and expense records</li>
              <li>Reviews, offers, and notifications</li>
              <li>Audit logs and dispute records</li>
              <li>Customer visit counters</li>
            </ul>
            <p className="mt-2 font-semibold">Kept: user accounts, salon info, services, products, customers</p>
          </div>
        </div>

        {result && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm ${
            result.success ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
          }`}>
            {result.success ? <CheckCircle className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
            {result.message}
          </div>
        )}

        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700">
            Type <span className="font-mono font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">RESET</span> to confirm:
          </p>
          <div className="flex gap-3 items-center">
            <input type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type RESET to confirm"
              className="px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent w-48" />
            <button type="button" onClick={handleReset} disabled={confirmText !== 'RESET' || resetting}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors inline-flex items-center gap-2">
              {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              Reset Database
            </button>
          </div>
        </div>
      </div>}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowModal(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{editing ? 'Edit Setting' : 'Add Setting'}</h3>
              <button type="button" onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Key</label>
                <input type="text" value={form.setting_key} onChange={(e) => setForm({ ...form, setting_key: e.target.value })}
                  disabled={!!editing}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Value</label>
                <input type="text" value={form.setting_value} onChange={(e) => setForm({ ...form, setting_value: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                  <select value={form.setting_type} onChange={(e) => setForm({ ...form, setting_type: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                    <option value="json">JSON</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={save}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-500 transition-all">
                {editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
