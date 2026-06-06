import { useState, useEffect } from 'react';
import { Image, Plus, Trash2, Star, Loader2, Link, X, Check } from 'lucide-react';
import { authHeaders } from './api';

interface MediaItem {
  id: number;
  media_url: string;
  media_type: string;
  title: string;
  description: string;
  is_cover: number;
  display_order: number;
}

export function SalonGallery() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ media_url: '', title: '', description: '' });

  const fetchMedia = async () => {
    try {
      const r = await fetch('/api/salon/media', { headers: authHeaders() });
      if (!r.ok) throw new Error('Failed to fetch');
      setItems(await r.json());
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchMedia(); }, []);

  const addMedia = async () => {
    if (!form.media_url.trim()) return;
    setSaving(true);
    try {
      const r = await fetch('/api/salon/media', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          media_url: form.media_url,
          media_type: 'image',
          title: form.title,
          description: form.description
        })
      });
      if (!r.ok) throw new Error('Failed to add');
      await fetchMedia();
      setShowForm(false);
      setForm({ media_url: '', title: '', description: '' });
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const deleteMedia = async (id: number) => {
    if (!window.confirm('Delete this image?')) return;
    try {
      await fetch(`/api/salon/media/${id}`, { method: 'DELETE', headers: authHeaders() });
      setItems((p) => p.filter((m) => m.id !== id));
    } catch (e: any) { setError(e.message); }
  };

  const setCover = async (id: number) => {
    try {
      await fetch(`/api/salon/media/${id}/cover`, { method: 'PUT', headers: authHeaders() });
      await fetchMedia();
    } catch (e: any) { setError(e.message); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Salon Gallery</h1>
          <p className="text-sm text-slate-500 mt-1">Manage salon photos and cover image</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-sm font-semibold">
          <Plus className="w-4 h-4" /> Add Photo
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-rose-50 text-rose-600 rounded-xl text-sm">{error}</div>}

      {showForm && (
        <div className="mb-6 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-700">Add Photo URL</h3>
            <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-slate-400" /></button>
          </div>
          <div className="space-y-3">
            <input placeholder="Image URL (https://...)" value={form.media_url} onChange={(e) => setForm({ ...form, media_url: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
            <div className="flex gap-2">
              <input placeholder="Title (optional)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
              <button onClick={addMedia} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-semibold disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Image className="w-16 h-16 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">No photos yet</p>
          <p className="text-sm mt-1">Add your salon photos to showcase your work</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item) => (
            <div key={item.id} className="group relative bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all">
              <div className="aspect-video bg-slate-100 relative overflow-hidden">
                {item.media_url ? (
                  <img src={item.media_url} alt={item.title || 'Salon photo'} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/400x225/e2e8f0/94a3b8?text=Photo'; }} />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-300"><Image className="w-12 h-12" /></div>
                )}
                {item.is_cover === 1 && (
                  <div className="absolute top-2 left-2 bg-amber-400 text-amber-900 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1"><Star className="w-3 h-3" /> Cover</div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  {item.is_cover !== 1 && (
                    <button onClick={() => setCover(item.id)} className="p-2 bg-white/90 rounded-full hover:bg-white transition-all"><Check className="w-4 h-4 text-green-600" /></button>
                  )}
                  <button onClick={() => deleteMedia(item.id)} className="p-2 bg-white/90 rounded-full hover:bg-white transition-all"><Trash2 className="w-4 h-4 text-rose-500" /></button>
                </div>
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-slate-700 truncate">{item.title || 'Untitled'}</p>
                {item.description && <p className="text-xs text-slate-400 truncate mt-0.5">{item.description}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
