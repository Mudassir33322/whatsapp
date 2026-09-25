import { useState, useEffect } from 'react';
import { Crown, Plus, X, Loader2, User, Power, Trash2, Shield, ShieldCheck, Eye, Pencil } from 'lucide-react';
import { useAdminAuth } from './AdminAuthContext';
import { useConfirm } from '../hooks/useConfirm';

interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'support' | 'viewer';
  is_active: boolean;
  last_login?: string;
  created_at: string;
}

const roleConfig: Record<string, { label: string; gradient: string; icon: any }> = {
  super_admin: { label: 'Super Admin', gradient: 'from-amber-500 to-orange-500', icon: Crown },
  admin: { label: 'Admin', gradient: 'from-indigo-500 to-violet-500', icon: Shield },
  support: { label: 'Support', gradient: 'from-blue-500 to-cyan-500', icon: ShieldCheck },
  viewer: { label: 'Viewer', gradient: 'from-slate-500 to-slate-600', icon: Eye },
};

export function AdminManage() {
  const { adminFetch } = useAdminAuth();
  const { confirm, confirmDialog } = useConfirm();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'admin' });

  const fetchAdmins = async (signal?: AbortSignal) => {
    try {
      const res = await adminFetch('/api/admin/admins', { signal });
      if (res.ok) setAdmins(await res.json());
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.error('[AdminManage] Failed to load admins:', err);
      setError(err instanceof Error ? err.message : 'Failed to load admins');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const ac = new AbortController();
    fetchAdmins(ac.signal);
    return () => ac.abort();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', email: '', password: '', role: 'admin' });
    setShowModal(true);
  };

  const openEdit = (a: AdminUser) => {
    setEditing(a);
    setForm({ name: a.name, email: a.email, password: '', role: a.role });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email) return;
    if (!editing && !form.password) return;
    if (!editing) {
      const pwd = form.password;
      if (pwd.length < 8) { setError('Password kam se kam 8 characters ka hona chahiye'); return; }
      if (!/[A-Z]/.test(pwd)) { setError('Password mein ek capital letter hona chahiye'); return; }
      if (!/[0-9]/.test(pwd)) { setError('Password mein ek number hona chahiye'); return; }
    }
    setSaving(true);
    try {
      if (editing) {
        const body: any = { name: form.name, email: form.email, role: form.role };
        const res = await adminFetch(`/api/admin/admins/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) });
        if (!res.ok) throw new Error('Failed to update admin');
      } else {
        const res = await adminFetch('/api/admin/admins', { method: 'POST', body: JSON.stringify(form) });
        if (!res.ok) throw new Error('Failed to create admin');
      }
      setShowModal(false);
      setForm({ name: '', email: '', password: '', role: 'admin' });
      fetchAdmins();
    } catch (err) {
      console.error('[AdminManage] Failed to save admin:', err);
      setError(err instanceof Error ? err.message : 'Failed to save admin');
    } finally { setSaving(false); }
  };

  const handleToggleActive = async (id: number, current: boolean) => {
    try {
      const res = await adminFetch(`/api/admin/admins/${id}`, { method: 'PUT', body: JSON.stringify({ is_active: !current }) });
      if (!res.ok) throw new Error('Failed to update admin status');
      fetchAdmins();
    } catch (err) {
      console.error('[AdminManage] Failed to toggle admin status:', err);
      setError('Failed to update admin status');
    }
  };

  const handleDelete = async (id: number, role: string) => {
    if (role === 'super_admin') return;
    const confirmed = await confirm('Delete Admin', 'Are you sure you want to delete this admin?', 'Delete', 'danger');
    if (!confirmed) return;
    try {
      const res = await adminFetch(`/api/admin/admins/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete admin');
      fetchAdmins();
    } catch (err) {
      console.error('[AdminManage] Failed to delete admin:', err);
      setError('Failed to delete admin');
    }
  };

  return (
    <div>
      {confirmDialog}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Crown className="w-6 h-6 text-amber-400" />
            Admin Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">Manage platform administrators & their roles</p>
        </div>
        <button type="button" onClick={openCreate} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-amber-500/20">
          <Plus className="w-4 h-4" /> Add Admin
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-rose-500/10 text-rose-400 rounded-xl text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700/50 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-800/30">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Admin</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Role</th>
                <th className="text-center px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Last Login</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-16 text-slate-500 text-sm">No admins found</td></tr>
              ) : admins.map((a) => {
                const role = roleConfig[a.role] || roleConfig.admin;
                const RoleIcon = role.icon;
                return (
                  <tr key={a.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="flex items-center gap-3 text-sm">
                        <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${role.gradient} flex items-center justify-center shadow-sm`}>
                          <RoleIcon className="w-4 h-4 text-white" />
                        </div>
                        <span>
                          <p className="text-white font-medium">{a.name}</p>
                          <p className="text-slate-400 text-xs">{a.email}</p>
                        </span>
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full font-semibold bg-gradient-to-r ${role.gradient} bg-clip-padding border border-white/5`}
                        style={{ backgroundImage: `linear-gradient(to right, var(--tw-gradient-stops))`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                        <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${role.gradient} flex items-center justify-center shrink-0`}
                          style={{ WebkitTextFillColor: 'white' }}>
                          <RoleIcon className="w-3 h-3 text-white" />
                        </div>
                        <span style={{ WebkitTextFillColor: 'initial', color: a.role === 'super_admin' ? '#fbbf24' : a.role === 'admin' ? '#818cf8' : a.role === 'support' ? '#60a5fa' : '#94a3b8' }}>
                          {role.label}
                        </span>
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${a.is_active ? 'text-emerald-400' : 'text-slate-500'}`}>
                        <span className={`w-2 h-2 rounded-full ${a.is_active ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                        {a.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-400">{a.last_login ? new Date(a.last_login).toLocaleDateString() : 'Never'}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {a.role !== 'super_admin' && (
                          <>
                            <button type="button" onClick={() => openEdit(a)}
                              className="p-2 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all"
                              title="Edit">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={() => handleToggleActive(a.id, a.is_active)}
                              className="p-2 text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all"
                              title={a.is_active ? 'Disable' : 'Enable'}>
                              <Power className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={() => handleDelete(a.id, a.role)}
                              className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                              title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {a.role === 'super_admin' && (
                          <span className="text-[10px] text-amber-500/60 font-medium px-2">Protected</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" />
                {editing ? 'Edit Admin' : 'Add New Admin'}
              </h3>
              <button type="button" onClick={() => setShowModal(false)} className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Name</label>
                <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/30 transition-all" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Email</label>
                <input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/30 transition-all" />
              </div>
              {!editing && (
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Password</label>
                  <input required type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/30 transition-all" />
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Role</label>
                <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/30 transition-all">
                  <option value="admin">Admin</option>
                  <option value="support">Support</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <button type="submit" disabled={saving} className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-semibold transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? <><Loader2 className="w-4 h-4 inline animate-spin mr-2" />Saving...</> : editing ? 'Update Admin' : 'Create Admin'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
