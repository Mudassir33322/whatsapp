import { useState, useEffect } from 'react';
import { Store, Plus, Pencil, Trash2, Key, X, Loader2 } from 'lucide-react';

interface Salon {
  id: number;
  name: string;
  owner_name: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  area: string;
  address: string;
  description: string;
  status: string;
  bookings: number;
}

interface Country { id: number; name: string; }
interface City { id: number; name: string; }
interface Area { id: number; name: string; }

const hd = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('admin-token')}` });

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-400',
  inactive: 'bg-rose-500/20 text-rose-400',
  pending: 'bg-amber-500/20 text-amber-400',
};

export function AdminSalons() {
  const [salons, setSalons] = useState<Salon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<{ mode: string; salon?: Salon } | null>(null);
  const [pwdModal, setPwdModal] = useState<Salon | null>(null);
  const [newPwd, setNewPwd] = useState('');
  const [countries, setCountries] = useState<Country[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [selCountry, setSelCountry] = useState('');
  const [selCity, setSelCity] = useState('');
  const [form, setForm] = useState({
    name: '', owner_name: '', phone: '', email: '', password: '',
    country_id: '', city_id: '', area_id: '', address: '', description: '',
  });

  const loadSalons = async () => {
    try {
      const res = await fetch('/api/admin/salons', { headers: hd() });
      if (!res.ok) throw new Error('Failed to load salons');
      setSalons(await res.json());
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadSalons(); }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/locations/countries', { headers: hd() });
        if (res.ok) setCountries(await res.json());
      } catch (_) {}
    })();
  }, []);

  useEffect(() => {
    if (!selCountry) { setCities([]); return; }
    (async () => {
      try {
        const res = await fetch(`/api/admin/locations/cities/${selCountry}`, { headers: hd() });
        if (res.ok) setCities(await res.json());
      } catch (_) {}
    })();
  }, [selCountry]);

  useEffect(() => {
    if (!selCity) { setAreas([]); return; }
    (async () => {
      try {
        const res = await fetch(`/api/admin/locations/areas/${selCity}`, { headers: hd() });
        if (res.ok) setAreas(await res.json());
      } catch (_) {}
    })();
  }, [selCity]);

  const openAdd = () => {
    setForm({ name: '', owner_name: '', phone: '', email: '', password: '', country_id: '', city_id: '', area_id: '', address: '', description: '' });
    setSelCountry(''); setSelCity(''); setCities([]); setAreas([]);
    setModal({ mode: 'add' });
  };

  const openEdit = (s: Salon) => {
    setForm({
      name: s.name, owner_name: s.owner_name, phone: s.phone, email: s.email, password: '',
      country_id: '', city_id: '', area_id: '', address: s.address, description: s.description,
    });
    setSelCountry(''); setSelCity(''); setCities([]); setAreas([]);
    setModal({ mode: 'edit', salon: s });
  };

  const save = async () => {
    const isEdit = modal?.mode === 'edit';
    const body: any = { name: form.name, owner_name: form.owner_name, phone: form.phone, email: form.email, country_id: +form.country_id, city_id: +form.city_id, area_id: +form.area_id, address: form.address, description: form.description };
    if (!isEdit) body.password = form.password;
    const url = isEdit ? `/api/admin/salons/${modal!.salon!.id}` : '/api/admin/salons';
    try {
      const res = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers: hd(), body: JSON.stringify(body) });
      if (!res.ok) throw new Error('Failed to save');
      await loadSalons();
      setModal(null);
    } catch (e: any) { setError(e.message); }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      const res = await fetch(`/api/admin/salons/${id}/status`, { method: 'PUT', headers: hd(), body: JSON.stringify({ status }) });
      if (!res.ok) throw new Error('Failed to update status');
      setSalons(prev => prev.map(s => s.id === id ? { ...s, status } : s));
    } catch (e: any) { setError(e.message); }
  };

  const resetPassword = async () => {
    if (!pwdModal || !newPwd) return;
    try {
      const res = await fetch(`/api/admin/salons/${pwdModal.id}/reset-password`, { method: 'POST', headers: hd(), body: JSON.stringify({ newPassword: newPwd }) });
      if (!res.ok) throw new Error('Failed to reset password');
      setPwdModal(null); setNewPwd('');
    } catch (e: any) { setError(e.message); }
  };

  const del = async (id: number) => {
    if (!window.confirm('Delete this salon?')) return;
    try {
      const res = await fetch(`/api/admin/salons/${id}`, { method: 'DELETE', headers: hd() });
      if (!res.ok) throw new Error('Failed to delete');
      setSalons(prev => prev.filter(s => s.id !== id));
    } catch (e: any) { setError(e.message); }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>;
  }

  if (error && salons.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-rose-500/10 text-rose-400 px-6 py-4 rounded-xl border border-rose-500/20 text-sm font-medium">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-white">Salons</h1><p className="text-sm text-slate-400 mt-1">Manage all registered salons</p></div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors"><Plus className="w-4 h-4" /> Add Salon</button>
      </div>

      {error && (
        <div className="flex items-center justify-between bg-rose-500/10 text-rose-400 px-4 py-3 rounded-xl border border-rose-500/20 text-sm">
          <span>{error}</span>
          <button onClick={() => setError('')} className="p-1 hover:bg-rose-500/20 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-700/50 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Owner</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Bookings</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {salons.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-16 text-center text-slate-500"><Store className="w-8 h-8 mx-auto mb-2 opacity-50" /><p>No salons yet</p></td></tr>
              ) : salons.map(s => (
                <tr key={s.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-white whitespace-nowrap">{s.name}</td>
                  <td className="px-5 py-3.5 text-slate-300 whitespace-nowrap">{s.owner_name}</td>
                  <td className="px-5 py-3.5 text-slate-300 whitespace-nowrap">{s.email}</td>
                  <td className="px-5 py-3.5 text-slate-300 whitespace-nowrap">{s.phone}</td>
                  <td className="px-5 py-3.5 text-slate-300 whitespace-nowrap">{`${s.country}, ${s.city}, ${s.area}`}</td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <select value={s.status} onChange={e => updateStatus(s.id, e.target.value)} className={`text-xs font-medium rounded-full px-2.5 py-0.5 border-0 cursor-pointer appearance-none ${statusColors[s.status] || 'bg-slate-500/20 text-slate-400'}`}>
                      <option value="active">active</option>
                      <option value="inactive">inactive</option>
                      <option value="pending">pending</option>
                    </select>
                  </td>
                  <td className="px-5 py-3.5 text-slate-300 text-right whitespace-nowrap">{s.bookings}</td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(s)} className="p-1.5 hover:bg-slate-600 rounded-lg transition-colors text-slate-400 hover:text-indigo-400"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setPwdModal(s)} className="p-1.5 hover:bg-slate-600 rounded-lg transition-colors text-slate-400 hover:text-amber-400"><Key className="w-3.5 h-3.5" /></button>
                      <button onClick={() => del(s.id)} className="p-1.5 hover:bg-slate-600 rounded-lg transition-colors text-slate-400 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(modal || pwdModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setModal(null); setPwdModal(null); }}>
          {modal && (
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white capitalize">{modal.mode} Salon</h3>
                <button onClick={() => setModal(null)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" placeholder="Salon Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500" />
                  <input type="text" placeholder="Owner Name" value={form.owner_name} onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="email" placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500" />
                  <input type="text" placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500" />
                </div>
                {modal.mode === 'add' && (
                  <input type="password" placeholder="Password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500" />
                )}
                <div className="grid grid-cols-3 gap-3">
                  <select value={selCountry} onChange={e => { setSelCountry(e.target.value); setForm(f => ({ ...f, country_id: e.target.value, city_id: '', area_id: '' })); setSelCity(''); }} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500">
                    <option value="">Country</option>
                    {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select value={selCity} onChange={e => { setSelCity(e.target.value); setForm(f => ({ ...f, city_id: e.target.value, area_id: '' })); }} disabled={!selCountry} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50">
                    <option value="">City</option>
                    {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select value={form.area_id} onChange={e => setForm(f => ({ ...f, area_id: e.target.value }))} disabled={!selCity} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50">
                    <option value="">Area</option>
                    {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <input type="text" placeholder="Address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500" />
                <textarea placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 resize-none" />
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setModal(null)} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-medium">Cancel</button>
                <button onClick={save} className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium">Save</button>
              </div>
            </div>
          )}
          {pwdModal && (
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 w-full max-w-sm mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Reset Password</h3>
                <button onClick={() => { setPwdModal(null); setNewPwd(''); }} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-sm text-slate-400 mb-3">New password for <span className="text-white font-medium">{pwdModal.name}</span></p>
              <input type="password" placeholder="Enter new password" value={newPwd} onChange={e => setNewPwd(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500" />
              <div className="flex gap-3 mt-4">
                <button onClick={() => { setPwdModal(null); setNewPwd(''); }} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-medium">Cancel</button>
                <button onClick={resetPassword} disabled={!newPwd} className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium">Reset</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
