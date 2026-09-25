import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Scissors, Plus, Pencil, Trash2, X, Loader2, Search, Star, Link2 } from 'lucide-react';
import { salonFetch } from './api';
import { EmptyState } from '../components/EmptyState';
import { useConfirm } from '../hooks/useConfirm';

interface SalonService {
  id: number; name: string; description: string; price: number; duration: number;
  category: string; status: string;
}
interface Barber { id: number; name: string; phone: string; }
interface BarberService { barber_id: number; service_id: number; price: number | null; }

const DF = { name: '', description: '', price: 0, duration: 30, category: '' };

export function SalonServices() {
  const { confirm, confirmDialog } = useConfirm();
  const [services, setServices] = useState<SalonService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(DF);
  const [editing, setEditing] = useState<SalonService | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const [linkService, setLinkService] = useState<SalonService | null>(null);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [barberServices, setBarberServices] = useState<BarberService[]>([]);
  const [customPrices, setCustomPrices] = useState<Record<number, string>>({});
  const fetchServices = async (signal?: AbortSignal) => {
    try {
      const r = await salonFetch('/api/salon/services', { signal });
      if (!r.ok) throw new Error('Failed to fetch services');
      setServices(await r.json());
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setError(e.message);
    }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const ac = new AbortController();
    fetchServices(ac.signal);
    return () => ac.abort();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const url = editing ? `/api/salon/services/${editing.id}` : '/api/salon/services';
      const r = await salonFetch(url, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(form) });
      if (!r.ok) throw new Error('Failed to save');
      await fetchServices();
      setShowForm(false); setEditing(null); setForm(DF);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const del = async (id: number) => {
    const confirmed = await confirm('Delete Service', 'Are you sure you want to delete this service? Barber links will also be removed.', 'Delete', 'danger');
    if (!confirmed) return;
    try {
      const r = await salonFetch(`/api/salon/services/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Failed to delete');
      setServices((p) => p.filter((s) => s.id !== id));
    } catch (e: any) { setError(e.message); }
  };

  const toggleStatus = async (s: SalonService) => {
    const newStatus = s.status === 'active' ? 'inactive' : 'active';
    try {
      const r = await salonFetch(`/api/salon/services/${s.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      if (!r.ok) throw new Error('Failed to toggle status');
      setServices((p) => p.map((x) => (x.id === s.id ? { ...x, status: newStatus } : x)));
    } catch (e: any) { setError(e.message); }
  };

  const edit = (s: SalonService) => {
    setForm({ name: s.name, description: s.description, price: s.price, duration: s.duration, category: s.category });
    setEditing(s); setShowForm(true);
  };

  const openLink = async (s: SalonService) => {
    setLinkService(s);
    setCustomPrices({});
    try {
      const [bRes, bsRes] = await Promise.all([
        salonFetch('/api/salon/barbers'),
        salonFetch(`/api/salon/barber-services/${s.id}`),
      ]);
      if (!bRes.ok || !bsRes.ok) throw new Error('Failed to load data');
      const barbersData: Barber[] = await bRes.json();
      const bsData: BarberService[] = await bsRes.json();
      setBarbers(barbersData);
      setBarberServices(bsData);
      const prices: Record<number, string> = {};
      for (const bs of bsData) {
        if (bs.price != null) prices[bs.barber_id] = String(bs.price);
      }
      setCustomPrices(prices);
    } catch (e: any) { setError(e.message); }
  };

  const isLinked = (barberId: number) => barberServices.some((bs) => bs.barber_id === barberId);

  const toggleBarberLink = async (barberId: number) => {
    if (!linkService) return;
    const linked = isLinked(barberId);
    try {
      if (linked) {
        const r = await salonFetch('/api/salon/barber-services', {
          method: 'DELETE',
          body: JSON.stringify({ barber_id: barberId, service_id: linkService.id }),
        });
        if (!r.ok) throw new Error('Failed to unlink');
        setBarberServices((p) => p.filter((bs) => bs.barber_id !== barberId));
      } else {
        const price = customPrices[barberId] ? Number(customPrices[barberId]) : undefined;
        const r = await salonFetch('/api/salon/barber-services', {
          method: 'POST',
          body: JSON.stringify({ barber_id: barberId, service_id: linkService.id, ...(price ? { price } : {}) }),
        });
        if (!r.ok) throw new Error('Failed to link');
        setBarberServices((p) => [...p, { barber_id: barberId, service_id: linkService.id, price: price ?? null }]);
      }
    } catch (e: any) { setError(e.message); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  if (error && !services.length) return <div className="flex items-center justify-center min-h-[60vh]"><div className="bg-red-50 text-red-700 px-6 py-4 rounded-xl border border-red-200 text-sm font-medium">{error}</div></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {confirmDialog}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Services</h1>
        <button type="button" onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Add Service
        </button>
      </div>
      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl border border-red-200 text-sm">{error}</div>}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search services..." className="w-full max-w-sm pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white" />
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3">Price (Rs)</th>
                <th className="px-6 py-3">Duration (min)</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(() => {
                const filtered = services.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.category?.toLowerCase().includes(search.toLowerCase()));
                if (filtered.length === 0) return <tr><td colSpan={6}><div className="px-6 py-8"><EmptyState icon={Scissors} title="No services found" description="Add your first service to get started" /></div></td></tr>;
                return filtered.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0"><Scissors className="w-4 h-4" /></div>
                      <div><p className="font-medium text-gray-900">{s.name}</p>{s.description && <p className="text-xs text-gray-400 truncate max-w-[200px]">{s.description}</p>}</div>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-gray-700 whitespace-nowrap">{s.category || '—'}</td>
                  <td className="px-6 py-3.5 text-gray-900 font-medium whitespace-nowrap">Rs {s.price}</td>
                  <td className="px-6 py-3.5 text-gray-700 whitespace-nowrap">{s.duration} min</td>
                  <td className="px-6 py-3.5 whitespace-nowrap">
                    <button type="button" onClick={() => toggleStatus(s)}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer border-0 ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {s.status === 'active' ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-6 py-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => edit(s)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit"><Pencil className="w-4 h-4" /></button>
                      <button type="button" onClick={() => openLink(s)} className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Link Barbers"><Link2 className="w-4 h-4" /></button>
                      <button type="button" onClick={() => del(s.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ));
            })()}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => { setShowForm(false); setEditing(null); setForm(DF); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-5 relative" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => { setShowForm(false); setEditing(null); setForm(DF); }} className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit Service' : 'Add Service'}</h2>
            <div className="space-y-4">
              <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Name <span className="text-red-400 ml-1">*</span></label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" placeholder="Service name" /></div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" placeholder="Brief description" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Price (Rs)</label>
                  <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" /></div>
                <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Duration (min)</label>
                  <input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" /></div>
              </div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Category</label>
                <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" placeholder="e.g. Hair, Skin, Nails" /></div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); setForm(DF); }} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Cancel</button>
              <button type="button" onClick={save} disabled={saving || !form.name.trim()} className="px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-colors inline-flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}{editing ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {linkService && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setLinkService(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-5 relative max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setLinkService(null)} className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-gray-900">Link Barbers — {linkService.name}</h2>
            {!barbers.length ? (
              <p className="text-sm text-gray-400 text-center py-4">No barbers available. Add barbers first.</p>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {barbers.map((b) => {
                  const linked = isLinked(b.id);
                  return (
                    <div key={b.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <input type="checkbox" checked={linked} onChange={() => toggleBarberLink(b.id)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-400 shrink-0" />
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-900">{b.name}</p><p className="text-xs text-gray-400">{b.phone}</p></div>
                      {linked && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <label className="text-xs text-gray-500">Price:</label>
                          <input type="number" value={customPrices[b.id] ?? ''} onChange={(e) => setCustomPrices((p) => ({ ...p, [b.id]: e.target.value }))}
                            className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            placeholder="Default" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex justify-end pt-2">
              <button type="button" onClick={() => setLinkService(null)} className="px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
