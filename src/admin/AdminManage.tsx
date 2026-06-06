import { useState, useEffect } from 'react';
import { Shield, Plus, X, Loader2, User, Mail, Power } from 'lucide-react';

interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'support' | 'viewer';
  is_active: boolean;
  last_login?: string;
  created_at: string;
}

export function AdminManage() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'admin' });

  const hd = () => ({ Authorization: `Bearer ${localStorage.getItem('admin-token')}`, 'Content-Type': 'application/json' });

  const fetchAdmins = async () => {
    try {
      const res = await fetch('/api/admin/admins', { headers: hd() });
      if (res.ok) setAdmins(await res.json());
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchAdmins(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return;
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: hd(),
        body: JSON.stringify(form)
      });
      if (res.ok) {
        setShowModal(false);
        setForm({ name: '', email: '', password: '', role: 'admin' });
        fetchAdmins();
      }
    } catch {}
  };

  const handleToggleActive = async (id: number, current: boolean) => {
    try {
      await fetch(`/api/admin/admins/${id}`, {
        method: 'PUT',
        headers: hd(),
        body: JSON.stringify({ is_active: !current })
      });
      fetchAdmins();
    } catch {}
  };

  const handleDelete = async (id: number, role: string) => {
    if (role === 'super_admin') return;
    if (!confirm('Delete this admin?')) return;
    try {
      await fetch(`/api/admin/admins/${id}`, { method: 'DELETE', headers: hd() });
      fetchAdmins();
    } catch {}
  };

  const roleBadge = (role: string) => {
    const colors: any = {
      super_admin: 'bg-amber-500/10 text-amber-400',
      admin: 'bg-indigo-500/10 text-indigo-400',
      support: 'bg-blue-500/10 text-blue-400',
      viewer: 'bg-slate-500/10 text-slate-400',
    };
    return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${colors[role] || colors.admin}`}>{role.replace('_', ' ')}</span>;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Management</h1>
          <p className="text-sm text-slate-400 mt-1">Manage platform administrators</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors">
          <Plus className="w-4 h-4" /> Add Admin
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>
      ) : (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Admin</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Role</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Last Login</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-slate-500 text-sm">No admins found</td></tr>
              ) : admins.map((a) => (
                <tr key={a.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2 text-sm">
                      <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                        <User className="w-4 h-4 text-indigo-400" />
                      </div>
                      <span>
                        <p className="text-white font-medium">{a.name}</p>
                        <p className="text-slate-400 text-xs">{a.email}</p>
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3">{roleBadge(a.role)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${a.is_active ? 'text-emerald-400' : 'text-slate-500'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${a.is_active ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                      {a.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">{a.last_login ? new Date(a.last_login).toLocaleDateString() : 'Never'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {a.role !== 'super_admin' && (
                        <>
                          <button onClick={() => handleToggleActive(a.id, a.is_active)} className="p-1.5 text-slate-400 hover:text-amber-400 transition-colors" title={a.is_active ? 'Disable' : 'Enable'}>
                            <Power className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(a.id, a.role)} className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors" title="Delete">
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Add New Admin</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-700 rounded-lg transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase mb-1.5 block">Name</label>
                <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase mb-1.5 block">Email</label>
                <input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase mb-1.5 block">Password</label>
                <input required type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase mb-1.5 block">Role</label>
                <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="admin">Admin</option>
                  <option value="support">Support</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-colors">
                Create Admin
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
