import { useState, useEffect, useCallback, useRef } from 'react';
import { Image, Plus, Trash2, Star, Loader2, Link, X, Check, Upload, Pencil } from 'lucide-react';
import { salonFetch } from './api';
import { API_URL } from '../config';
import { mediaUrl } from '../lib/mediaUrl';
import { useConfirm } from '../hooks/useConfirm';

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
  const { confirm, confirmDialog } = useConfirm();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadTab, setUploadTab] = useState<'file' | 'url'>('file');
  const [form, setForm] = useState({ media_url: '', title: '', description: '' });
  const [editing, setEditing] = useState<MediaItem | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '' });
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchMedia = useCallback(async (signal?: AbortSignal) => {
    setError('');
    try {
      const r = await salonFetch('/api/salon/media', { signal });
      if (!r.ok) {
        const errorData = await r.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch media');
      }
      setItems(await r.json());
    } catch (e: any) {
      if (e?.name !== 'AbortError') setError(e.message);
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    fetchMedia(ac.signal);
    return () => ac.abort();
  }, []);

  const addMedia = async () => {
    if (!form.media_url.trim()) return;
    setSaving(true);
    try {
      const r = await salonFetch('/api/salon/media', {
        method: 'POST',
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

  const uploadFile = async (file: File) => {
    setSaving(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('title', form.title);
      fd.append('description', form.description);
      const token = localStorage.getItem('salon-token');
      const r = await fetch(`${API_URL}/api/salon/media/upload`, {
        method: 'POST',
        headers: token ? { Authorization: 'Bearer ' + token } : {},
        body: fd
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error || 'Upload failed');
      }
      await fetchMedia();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const uploadMultipleFiles = async (files: FileList) => {
    setSaving(true);
    setError('');
    try {
      const fileArray = Array.from(files);
      for (const file of fileArray) {
        await uploadFile(file);
      }
      setShowForm(false);
      setForm({ media_url: '', title: '', description: '' });
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const deleteMedia = async (id: number) => {
    const confirmed = await confirm('Delete Image', 'Are you sure you want to delete this image from the gallery? This cannot be undone.', 'Delete', 'danger');
    if (!confirmed) return;
    try {
      await salonFetch(`/api/salon/media/${id}`, { method: 'DELETE' });
      setItems((p) => p.filter((m) => m.id !== id));
    } catch (e: any) { setError(e.message); }
  };

  const startEdit = (item: MediaItem) => {
    setEditing(item);
    setEditForm({ title: item.title || '', description: item.description || '' });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const r = await salonFetch(`/api/salon/media/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm)
      });
      if (!r.ok) throw new Error('Failed to update');
      await fetchMedia();
      setEditing(null);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const setCover = async (id: number) => {
    try {
      await salonFetch(`/api/salon/media/${id}/cover`, { method: 'PUT' });
      await fetchMedia();
    } catch (e: any) { setError(e.message); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;

  return (
    <div>
      {confirmDialog}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Salon Gallery</h1>
          <p className="text-sm text-slate-500 mt-1">Manage salon photos and cover image</p>
        </div>
        <button type="button" onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-sm font-semibold">
          <Plus className="w-4 h-4" /> Add Photo
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-rose-50 text-rose-600 rounded-xl text-sm">{error}</div>}

      {showForm && (
        <div className="mb-6 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-700">Add Photo</h3>
            <button type="button" onClick={() => setShowForm(false)}><X className="w-4 h-4 text-slate-400" /></button>
          </div>
          <div className="flex gap-1 mb-4 bg-slate-100 rounded-lg p-1">
            <button type="button" onClick={() => setUploadTab('file')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${uploadTab === 'file' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <Upload className="w-4 h-4 inline mr-1.5" />File Upload
            </button>
            <button type="button" onClick={() => setUploadTab('url')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${uploadTab === 'url' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <Link className="w-4 h-4 inline mr-1.5" />URL
            </button>
          </div>
          <div className="space-y-3">
            {uploadTab === 'file' ? (
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-all"
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files && files.length > 0) uploadMultipleFiles(files);
                    e.target.value = '';
                  }}
                />
                <Upload className="w-10 h-10 mx-auto mb-2 text-slate-400" />
                <p className="text-sm font-medium text-slate-600">Click to upload image(s)</p>
                <p className="text-xs text-slate-400 mt-1">Multiple select kar sakte hain — JPG, PNG, GIF up to 10MB each</p>
              </div>
            ) : (
               <input type="text" placeholder="Image URL (https://...)" value={form.media_url} onChange={(e) => setForm({ ...form, media_url: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
            )}
            <div className="flex gap-2">
               <input type="text" placeholder="Title (optional)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
              {uploadTab === 'url' && (
                <button type="button" onClick={addMedia} disabled={saving || !form.media_url.trim()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-semibold disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
                </button>
              )}
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
                  <img src={mediaUrl(item.media_url)} alt={item.title || 'Salon photo'} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/400x225/e2e8f0/94a3b8?text=Photo'; }} />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-300"><Image className="w-12 h-12" /></div>
                )}
                {item.is_cover === 1 && (
                  <div className="absolute top-2 left-2 bg-amber-400 text-amber-900 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1"><Star className="w-3 h-3" /> Cover</div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  {item.is_cover !== 1 && (
                    <button type="button" onClick={() => setCover(item.id)} className="p-2 bg-white/90 rounded-full hover:bg-white transition-all"><Check className="w-4 h-4 text-green-600" /></button>
                  )}
                  <button type="button" onClick={() => startEdit(item)} className="p-2 bg-white/90 rounded-full hover:bg-white transition-all"><Pencil className="w-4 h-4 text-blue-600" /></button>
                  <button type="button" onClick={() => deleteMedia(item.id)} className="p-2 bg-white/90 rounded-full hover:bg-white transition-all"><Trash2 className="w-4 h-4 text-rose-500" /></button>
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

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Edit Photo</h3>
              <button type="button" onClick={() => setEditing(null)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <input placeholder="Title" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
              <textarea placeholder="Description" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none" />
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setEditing(null)} className="flex-1 px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 text-sm font-medium transition-all">Cancel</button>
                <button type="button" onClick={saveEdit} disabled={saving} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-semibold disabled:opacity-50 transition-all">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
