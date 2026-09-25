import { useState, useEffect, useMemo } from 'react';
import { Star, MessageSquareText, Loader2, Plus, Pencil, Trash2, X, Search } from 'lucide-react';
import { salonFetch } from './api';
import { useConfirm } from '../hooks/useConfirm';

interface Review {
  id: number;
  customer_name: string;
  customer_phone?: string;
  rating: number;
  comment: string;
  created_at: string;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function Stars({ rating, onChange }: { rating: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <button key={i} type="button" disabled={!onChange}
          onClick={() => onChange?.(i + 1)}
          className={`w-5 h-5 ${onChange ? 'cursor-pointer hover:scale-110' : ''} transition-transform ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`}>
          <Star className={`w-full h-full ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
        </button>
      ))}
    </div>
  );
}

export function SalonReviews() {
  const { confirm, confirmDialog } = useConfirm();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState(0);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Review | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ customer_phone: '', rating: 5, comment: '' });

  const fetchReviews = async (signal?: AbortSignal) => {
    try {
      const r = await salonFetch('/api/salon/reviews', { signal });
      if (!r.ok) throw new Error('Failed to fetch reviews');
      setReviews(await r.json());
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setError(e.message);
    }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const ac = new AbortController();
    fetchReviews(ac.signal);
    return () => ac.abort();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ customer_phone: '', rating: 5, comment: '' });
    setShowModal(true);
  };

  const openEdit = (r: Review) => {
    setEditing(r);
    setForm({ customer_phone: r.customer_phone || '', rating: r.rating, comment: r.comment });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.customer_phone || !form.rating) {
      setError('Customer phone and rating required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        const r = await salonFetch(`/api/salon/reviews/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify({ rating: form.rating, comment: form.comment }),
        });
        if (!r.ok) throw new Error('Failed to update');
      } else {
        const r = await salonFetch('/api/salon/reviews', {
          method: 'POST',
          body: JSON.stringify({ customer_phone: form.customer_phone, rating: form.rating, comment: form.comment }),
        });
        if (!r.ok) throw new Error('Failed to create');
      }
      setShowModal(false);
      fetchReviews();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirm('Delete Review', 'Are you sure you want to delete this review? This action cannot be undone.', 'Delete', 'danger');
    if (!confirmed) return;
    try {
      const r = await salonFetch(`/api/salon/reviews/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Failed to delete');
      setReviews((p) => p.filter((rv) => rv.id !== id));
    } catch (e: any) { setError(e.message); }
  };

  const filteredReviews = useMemo(() =>
    reviews.filter(r => (
      (!search || r.customer_name?.toLowerCase().includes(search.toLowerCase()) || r.customer_phone?.includes(search) || r.comment?.toLowerCase().includes(search.toLowerCase()))
      && (!ratingFilter || r.rating === ratingFilter)
    )),
    [reviews, search, ratingFilter]
  );

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {confirmDialog}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquareText className="w-6 h-6 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Reviews</h1>
        </div>
        <button type="button" onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg transition-all text-sm font-semibold">
          <Plus className="w-4 h-4" /> Add Review
        </button>
      </div>

      {error && <div className="bg-rose-50 text-rose-700 px-4 py-3 rounded-2xl border border-rose-200 text-sm">{error}</div>}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reviews..." className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white" />
        </div>
        <div className="flex gap-1">
          {[0, 5, 4, 3, 2, 1].map(r => (
            <button type="button" key={r} onClick={() => setRatingFilter(r === ratingFilter ? 0 : r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${r === ratingFilter ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              {r === 0 ? 'All' : `${r}★`}
            </button>
          ))}
        </div>
      </div>

      {!reviews.length ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <MessageSquareText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm font-medium">No reviews yet</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredReviews.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow space-y-3 relative group">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="font-semibold text-gray-900 text-sm">{r.customer_name || r.customer_phone}</p>
                  <Stars rating={r.rating} />
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(r.created_at)}</span>
              </div>
              {r.comment && <p className="text-sm text-gray-600 leading-relaxed">{r.comment}</p>}
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button type="button" onClick={() => openEdit(r)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => handleDelete(r.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowModal(false)}>
          <div onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-amber-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-800">{editing ? 'Edit Review' : 'Add Review'}</h2>
              <button type="button" onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Customer Phone *</label>
                <input type="text" value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                  disabled={!!editing}
                  className="w-full px-4 py-2.5 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:bg-slate-50" placeholder="e.g. 923001234567" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Rating</label>
                <Stars rating={form.rating} onChange={(v) => setForm({ ...form, rating: v })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Comment</label>
                <textarea value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} rows={3}
                  className="w-full px-4 py-2.5 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" placeholder="Review comment..." />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 border border-amber-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-amber-50 transition-all">Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-all disabled:opacity-50">
                {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
