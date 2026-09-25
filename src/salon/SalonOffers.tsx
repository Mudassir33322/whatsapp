import { useState, useEffect } from 'react';
import { Percent, Plus, Pencil, Trash2, X, Tag, Loader2, Search } from 'lucide-react';
import { salonFetch } from './api';
import { useConfirm } from '../hooks/useConfirm';

interface Offer {
  id: number; title: string; description: string; discount_percent: number;
  valid_from: string; valid_until: string; is_active: boolean;
}

const DF = { title: '', description: '', discount_percent: 0, valid_from: '', valid_until: '', is_active: true };

function formatDate(d: string) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function SalonOffers() {
  const { confirm, confirmDialog } = useConfirm();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(DF);
  const [editing, setEditing] = useState<Offer | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchOffers = async (signal?: AbortSignal) => {
    try {
      const r = await salonFetch('/api/salon/offers', { signal });
      if (!r.ok) throw new Error('Failed to fetch offers');
      setOffers(await r.json());
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setError(e.message);
    }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const ac = new AbortController();
    fetchOffers(ac.signal);
    return () => ac.abort();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const url = editing ? `/api/salon/offers/${editing.id}` : '/api/salon/offers';
      const r = await salonFetch(url, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(form) });
      if (!r.ok) throw new Error('Failed to save');
      await fetchOffers();
      setShowForm(false); setEditing(null); setForm(DF);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const del = async (id: number) => {
    const confirmed = await confirm('Delete Offer', 'Are you sure you want to delete this offer? This action cannot be undone.', 'Delete', 'danger');
    if (!confirmed) return;
    try {
      const r = await salonFetch(`/api/salon/offers/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Failed to delete');
      setOffers((p) => p.filter((o) => o.id !== id));
    } catch (e: any) { setError(e.message); }
  };

  const toggleActive = async (o: Offer) => {
    try {
      const r = await salonFetch(`/api/salon/offers/${o.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !o.is_active }),
      });
      if (!r.ok) throw new Error('Failed to toggle');
      setOffers((p) => p.map((x) => (x.id === o.id ? { ...x, is_active: !x.is_active } : x)));
    } catch (e: any) { setError(e.message); }
  };

  const edit = (o: Offer) => {
    setForm({ title: o.title, description: o.description, discount_percent: o.discount_percent, valid_from: o.valid_from, valid_until: o.valid_until, is_active: o.is_active });
    setEditing(o); setShowForm(true);
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  if (error && !offers.length) return <div className="flex items-center justify-center min-h-[60vh]"><div className="bg-red-50 text-red-700 px-6 py-4 rounded-xl border border-red-200 text-sm font-medium">{error}</div></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {confirmDialog}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Offers</h1>
        <button type="button" onClick={() => { setForm(DF); setEditing(null); setShowForm(true); }} className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Add Offer
        </button>
      </div>
      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl border border-red-200 text-sm">{error}</div>}

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search offers..." className="w-full max-w-sm pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white" />
      </div>

      {!offers.length ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <Tag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm font-medium">No offers created yet</p>
          <p className="text-gray-300 text-xs mt-1">Click "Add Offer" to create your first promotion</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {offers.filter(o => !search || o.title.toLowerCase().includes(search.toLowerCase())).map((o) => (
            <div key={o.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-5 text-center">
                <Percent className="w-6 h-6 text-white/80 mx-auto mb-1" />
                <p className="text-3xl font-extrabold text-white">{o.discount_percent}% OFF</p>
              </div>
              <div className="p-4 space-y-2">
                <h3 className="font-bold text-gray-900 text-base truncate">{o.title}</h3>
                {o.description && <p className="text-sm text-gray-500 line-clamp-2">{o.description}</p>}
                <div className="flex items-center gap-2 text-xs text-gray-400 pt-1">
                  <span>{formatDate(o.valid_from)}</span>
                  <span>→</span>
                  <span>{formatDate(o.valid_until)}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <button type="button" onClick={() => toggleActive(o)}
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer border-0 ${o.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {o.is_active ? 'Active' : 'Inactive'}
                  </button>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => edit(o)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit"><Pencil className="w-4 h-4" /></button>
                    <button type="button" onClick={() => del(o.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => { setShowForm(false); setEditing(null); setForm(DF); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-5 relative" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => { setShowForm(false); setEditing(null); setForm(DF); }} className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit Offer' : 'Add Offer'}</h2>
            <div className="space-y-4">
              <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Title <span className="text-red-400 ml-1">*</span></label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" placeholder="Offer title" /></div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" placeholder="Offer description" /></div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Discount Percent <span className="text-red-400 ml-1">*</span></label>
                <input type="number" min={0} max={100} value={form.discount_percent} onChange={(e) => setForm({ ...form, discount_percent: Number(e.target.value) })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Valid From <span className="text-red-400 ml-1">*</span></label>
                  <input type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" /></div>
                <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Valid Until <span className="text-red-400 ml-1">*</span></label>
                  <input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" /></div>
              </div>
              <label className="flex items-center gap-2.5 text-sm text-gray-700 font-medium cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-400 w-4 h-4" />
                Active
              </label>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); setForm(DF); }} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Cancel</button>
              <button type="button" onClick={save} disabled={saving || !form.title.trim() || !form.discount_percent || !form.valid_from || !form.valid_until} className="px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-colors inline-flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}{editing ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
