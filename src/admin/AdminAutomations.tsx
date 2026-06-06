import { useState, useEffect } from 'react';
import { Bot, Store, Plus, Pencil, Trash2, X, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';

export function AdminAutomations() {
  const [automations, setAutomations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ salon_id: '', trigger_type: 'welcome', action_type: 'send_message', action_config: '{}', is_active: true });

  const hd = () => ({ Authorization: `Bearer ${localStorage.getItem('admin-token')}`, 'Content-Type': 'application/json' });

  const fetchAll = async () => {
    try {
      const r = await fetch('/api/admin/automations', { headers: hd() });
      if (r.ok) setAutomations(await r.json());
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const save = async () => {
    if (!form.salon_id || !form.trigger_type || !form.action_type) return;
    setSaving(true);
    try {
      const body = { salon_id: Number(form.salon_id), trigger_type: form.trigger_type, action_type: form.action_type, action_config: form.action_config, is_active: form.is_active };
      const url = editing ? `/api/admin/automations/${editing.id}` : '/api/admin/automations';
      const r = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: hd(), body: JSON.stringify(body) });
      if (!r.ok) throw new Error('Failed to save');
      await fetchAll();
      setShowForm(false); setEditing(null); setForm({ salon_id: '', trigger_type: 'welcome', action_type: 'send_message', action_config: '{}', is_active: true });
    } catch {} finally { setSaving(false); }
  };

  const del = async (id: number) => {
    if (!window.confirm('Delete this automation?')) return;
    try {
      await fetch(`/api/admin/automations/${id}`, { method: 'DELETE', headers: hd() });
      setAutomations((p) => p.filter((a) => a.id !== id));
    } catch {}
  };

  const toggle = async (a: any) => {
    try {
      await fetch(`/api/admin/automations/${a.id}`, { method: 'PUT', headers: hd(), body: JSON.stringify({ ...a, is_active: !a.is_active }) });
      await fetchAll();
    } catch {}
  };

  const edit = (a: any) => {
    setForm({ salon_id: String(a.salon_id), trigger_type: a.trigger_type, action_type: a.action_type, action_config: a.action_config || '{}', is_active: a.is_active });
    setEditing(a); setShowForm(true);
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>;

  const triggerLabels: Record<string, string> = { welcome: 'Welcome Message', booking: 'After Booking', review: 'After Review', reminder: 'Reminder' };
  const actionLabels: Record<string, string> = { send_message: 'Send Message', add_tag: 'Add Tag', webhook: 'Webhook' };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Automations</h1>
          <p className="text-sm text-slate-400 mt-1">Bot workflow automations across all salons</p>
        </div>
        <button onClick={() => { setEditing(null); setForm({ salon_id: '', trigger_type: 'welcome', action_type: 'send_message', action_config: '{}', is_active: true }); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-sm font-semibold">
          <Plus className="w-4 h-4" /> New Automation
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-4 bg-slate-800 rounded-xl border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">{editing ? 'Edit Automation' : 'New Automation'}</h3>
            <button onClick={() => setShowForm(false)} className="p-1 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Salon ID</label>
              <input value={form.salon_id} onChange={(e) => setForm({ ...form, salon_id: e.target.value })} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Salon ID" type="number" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Trigger</label>
              <select value={form.trigger_type} onChange={(e) => setForm({ ...form, trigger_type: e.target.value })} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="welcome">Welcome Message</option>
                <option value="booking">After Booking</option>
                <option value="review">After Review</option>
                <option value="reminder">Reminder</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Action</label>
              <select value={form.action_type} onChange={(e) => setForm({ ...form, action_type: e.target.value })} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="send_message">Send Message</option>
                <option value="add_tag">Add Tag</option>
                <option value="webhook">Webhook</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Active</label>
              <button onClick={() => setForm({ ...form, is_active: !form.is_active })} className="flex items-center gap-2 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white">
                {form.is_active ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                {form.is_active ? 'Active' : 'Inactive'}
              </button>
            </div>
          </div>
          <div className="mt-4 flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-400 hover:bg-slate-700 rounded-lg transition-all">Cancel</button>
            <button onClick={save} disabled={saving || !form.salon_id} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all">
              {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800/50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Salon</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Trigger</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Action</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Status</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {automations.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-slate-500 text-sm">No automations configured</td></tr>
            ) : automations.map((a: any) => (
              <tr key={a.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                <td className="px-4 py-3"><span className="flex items-center gap-1.5 text-sm text-white"><Store className="w-3.5 h-3.5 text-slate-400" />{a.salon_name || `Salon #${a.salon_id}`}</span></td>
                <td className="px-4 py-3 text-sm text-slate-300">{triggerLabels[a.trigger_type] || a.trigger_type}</td>
                <td className="px-4 py-3 text-sm text-slate-300">{actionLabels[a.action_type] || a.action_type}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => toggle(a)} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${a.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}`}>
                    {a.is_active ? <ToggleRight className="w-3 h-3" /> : <ToggleLeft className="w-3 h-3" />}
                    {a.is_active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => edit(a)} className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-700 rounded-lg transition-all"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => del(a.id)} className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-700 rounded-lg transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
