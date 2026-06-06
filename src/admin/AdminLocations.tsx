import { useState, useEffect } from 'react';
import { Flag, MapPin, Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react';

interface Country { id: number; name: string; phone_code: string; is_active: number; }
interface City { id: number; country_id: number; name: string; is_active: number; }
interface Area { id: number; city_id: number; name: string; is_active: number; }

const hd = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('admin-token')}` });

export function AdminLocations() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [cid, setCid] = useState<number | null>(null);
  const [aid, setAid] = useState<number | null>(null);
  const [load, setLoad] = useState({ c: true, ct: false, a: false });
  const [err, setErr] = useState('');
  const [modal, setModal] = useState<{ t: string; m: string; d?: any } | null>(null);
  const [form, setForm] = useState({ name: '', phone_code: '', is_active: true });

  useEffect(() => {
    if (!modal) return;
    setForm({ name: modal.d?.name || '', phone_code: modal.d?.phone_code || '', is_active: modal.d ? !!modal.d.is_active : true });
  }, [modal]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/locations/countries', { headers: hd() });
        if (!res.ok) throw new Error('Failed to load countries');
        const data = await res.json();
        setCountries(data);
        if (data.length > 0 && !cid) setCid(data[0].id);
      } catch (e: any) { setErr(e.message); }
      finally { setLoad(p => ({ ...p, c: false })); }
    })();
  }, []);

  useEffect(() => {
    setAid(null);
    if (!cid) { setCities([]); return; }
    (async () => {
      try {
        setLoad(p => ({ ...p, ct: true }));
        const res = await fetch(`/api/admin/locations/cities/${cid}`, { headers: hd() });
        if (!res.ok) throw new Error('Failed to load cities');
        setCities(await res.json());
      } catch (e: any) { setErr(e.message); }
      finally { setLoad(p => ({ ...p, ct: false })); }
    })();
  }, [cid]);

  useEffect(() => {
    if (!aid) { setAreas([]); return; }
    (async () => {
      try {
        setLoad(p => ({ ...p, a: true }));
        const res = await fetch(`/api/admin/locations/areas/${aid}`, { headers: hd() });
        if (!res.ok) throw new Error('Failed to load areas');
        setAreas(await res.json());
      } catch (e: any) { setErr(e.message); }
      finally { setLoad(p => ({ ...p, a: false })); }
    })();
  }, [aid]);

  const save = async () => {
    setErr('');
    if (!modal) return;
    const { t: type, m: mode, d: data } = modal;
    const edit = mode === 'edit';
    const body: Record<string, any> = { name: form.name, is_active: form.is_active ? 1 : 0 };
    if (type === 'country') body.phone_code = form.phone_code;
    else if (type === 'city') body.country_id = cid;
    else if (type === 'area') body.city_id = aid;
    const pm: Record<string, string> = { country: 'countries', city: 'cities', area: 'areas' };
    const url = edit ? `/api/admin/locations/${pm[type]}/${data.id}` : `/api/admin/locations/${pm[type]}`;
    try {
      const res = await fetch(url, { method: edit ? 'PUT' : 'POST', headers: hd(), body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json().catch(() => ({ error: 'Failed to save' })); throw new Error(e.error || 'Failed to save'); }
      const s = await res.json();
      if (type === 'country') setCountries((prev: Country[]) => edit ? prev.map(x => x.id === data.id ? s : x) : [...prev, s]);
      else if (type === 'city') setCities((prev: City[]) => edit ? prev.map(x => x.id === data.id ? s : x) : [...prev, s]);
      else setAreas((prev: Area[]) => edit ? prev.map(x => x.id === data.id ? s : x) : [...prev, s]);
      setModal(null);
    } catch (e: any) { setErr(e.message); }
  };

  const del = async (type: string, id: number) => {
    setErr('');
    if (!window.confirm('Delete this item?')) return;
    const pm: Record<string, string> = { country: 'countries', city: 'cities', area: 'areas' };
    try {
      const res = await fetch(`/api/admin/locations/${pm[type]}/${id}`, { method: 'DELETE', headers: hd() });
      if (!res.ok) { const e = await res.json().catch(() => ({ error: 'Failed to delete' })); throw new Error(e.error || 'Failed to delete'); }
      const f = (prev: any[]) => prev.filter(x => x.id !== id);
      if (type === 'country') setCountries(f);
      else if (type === 'city') setCities(f);
      else setAreas(f);
    } catch (e: any) { setErr(e.message); }
  };

  if (load.c) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>;
  }

  const Bdg = ({ a }: { a: number }) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${a ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}`}>{a ? 'Active' : 'Inactive'}</span>
  );

  const Act = ({ t, d }: { t: string; d: any }) => (
    <div className="flex items-center gap-1">
      <button onClick={() => setModal({ t, m: 'edit', d })} className="p-1.5 hover:bg-slate-600 rounded-lg transition-colors text-slate-400 hover:text-indigo-400"><Pencil className="w-3.5 h-3.5" /></button>
      <button onClick={() => del(t, d.id)} className="p-1.5 hover:bg-slate-600 rounded-lg transition-colors text-slate-400 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
    </div>
  );

  const Pnl = ({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) => (
    <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2"><Icon className="w-4 h-4 text-indigo-400" /><h2 className="font-semibold text-white text-sm">{title}</h2></div>
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white">Locations</h1><p className="text-sm text-slate-400 mt-1">Manage countries, cities, and areas</p></div>

      {err && (
        <div className="flex items-center justify-between bg-rose-500/10 text-rose-400 px-4 py-3 rounded-xl border border-rose-500/20 text-sm">
          <span>{err}</span>
          <button onClick={() => setErr('')} className="p-1 hover:bg-rose-500/20 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Pnl title="Countries" icon={Flag}>
          <div className="p-4 border-b border-slate-700">
            <button onClick={() => setModal({ t: 'country', m: 'add' })} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors"><Plus className="w-4 h-4" /> Add Country</button>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-700/50 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider"><th className="px-4 py-2.5">Name</th><th className="px-4 py-2.5">Code</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5"></th></tr></thead>
            <tbody className="divide-y divide-slate-700">
              {countries.length === 0 ? <tr><td colSpan={4} className="px-4 py-12 text-center text-slate-500 text-sm">No countries</td></tr>
              : countries.map(c => (
                <tr key={c.id} onClick={() => setCid(prev => prev === c.id ? null : c.id)} className={`cursor-pointer transition-colors ${cid === c.id ? 'bg-indigo-600/10' : 'hover:bg-slate-700/30'}`}>
                  <td className="px-4 py-3 font-medium text-white whitespace-nowrap">{c.name}</td>
                  <td className="px-4 py-3 text-slate-300">{c.phone_code}</td>
                  <td className="px-4 py-3"><Bdg a={c.is_active} /></td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}><Act t="country" d={c} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Pnl>

        <Pnl title="Cities" icon={MapPin}>
          <div className="p-4 border-b border-slate-700">
            <button onClick={() => cid && setModal({ t: 'city', m: 'add' })} disabled={!cid} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors"><Plus className="w-4 h-4" /> Add City</button>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-700/50 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider"><th className="px-4 py-2.5">Name</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5"></th></tr></thead>
            <tbody className="divide-y divide-slate-700">
              {load.ct ? <tr><td colSpan={3} className="px-4 py-12 text-center"><Loader2 className="w-5 h-5 animate-spin text-indigo-400 mx-auto" /></td></tr>
              : cities.length === 0 ? <tr><td colSpan={3} className="px-4 py-12 text-center text-slate-500 text-sm">{cid ? 'No cities' : 'Select a country'}</td></tr>
              : cities.map(c => (
                <tr key={c.id} onClick={() => setAid(prev => prev === c.id ? null : c.id)} className={`cursor-pointer transition-colors ${aid === c.id ? 'bg-indigo-600/10' : 'hover:bg-slate-700/30'}`}>
                  <td className="px-4 py-3 font-medium text-white whitespace-nowrap">{c.name}</td>
                  <td className="px-4 py-3"><Bdg a={c.is_active} /></td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}><Act t="city" d={c} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Pnl>

        <Pnl title="Areas" icon={MapPin}>
          <div className="p-4 border-b border-slate-700">
            <button onClick={() => aid && setModal({ t: 'area', m: 'add' })} disabled={!aid} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors"><Plus className="w-4 h-4" /> Add Area</button>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-700/50 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider"><th className="px-4 py-2.5">Name</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5"></th></tr></thead>
            <tbody className="divide-y divide-slate-700">
              {load.a ? <tr><td colSpan={3} className="px-4 py-12 text-center"><Loader2 className="w-5 h-5 animate-spin text-indigo-400 mx-auto" /></td></tr>
              : areas.length === 0 ? <tr><td colSpan={3} className="px-4 py-12 text-center text-slate-500 text-sm">{aid ? 'No areas' : 'Select a city'}</td></tr>
              : areas.map(a => (
                <tr key={a.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-white whitespace-nowrap">{a.name}</td>
                  <td className="px-4 py-3"><Bdg a={a.is_active} /></td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}><Act t="area" d={a} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Pnl>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setModal(null)}>
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white capitalize">{modal.m} {modal.t}</h3>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <input type="text" placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500" />
              {modal.t === 'country' && <input type="text" placeholder="Phone Code (e.g. +1)" value={form.phone_code} onChange={e => setForm(f => ({ ...f, phone_code: e.target.value }))} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500" />}
              <label className="flex items-center gap-3 text-sm text-slate-300 cursor-pointer select-none">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500" />
                Active
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModal(null)} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-medium">Cancel</button>
              <button onClick={save} className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
