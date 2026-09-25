import { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw, Loader2, Bell, CheckCircle2, Package, Plus, Pencil, Trash2, X } from 'lucide-react';
import { salonFetch } from './api';
import { useConfirm } from '../hooks/useConfirm';

interface Product {
  id: number;
  name: string;
  stock: number;
  min_stock: number;
  unit: string;
  price: number;
}

export function SalonStockAlerts() {
  const { confirm, confirmDialog } = useConfirm();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', price: '', stock: '', min_stock: '', unit: 'pcs' });

  const fetchProducts = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const r = await salonFetch('/api/salon/products', { signal });
      if (!r.ok) throw new Error('Failed to fetch');
      setProducts(await r.json());
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setError(e.message);
    }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const ac = new AbortController();
    fetchProducts(ac.signal);
    return () => ac.abort();
  }, []);

  const lowStock = products.filter((p) => p.stock <= p.min_stock && p.stock > 0);
  const outOfStock = products.filter((p) => p.stock === 0);
  const okStock = products.filter((p) => p.stock > p.min_stock);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', price: '', stock: '', min_stock: '', unit: 'pcs' });
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ name: p.name, price: String(p.price), stock: String(p.stock), min_stock: String(p.min_stock), unit: p.unit });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.price) {
      setError('Name and price required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const body: any = {
        name: form.name,
        price: Number(form.price),
        stock: Number(form.stock) || 0,
        min_stock: Number(form.min_stock) || 0,
        unit: form.unit,
      };
      const r = editing
        ? await salonFetch(`/api/salon/products/${editing.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : await salonFetch('/api/salon/products', {
            method: 'POST',
            body: JSON.stringify(body),
          });
      if (!r.ok) throw new Error('Failed to save');
      setShowModal(false);
      fetchProducts();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirm('Delete Product', 'Are you sure you want to delete this product? Stock history will be lost.', 'Delete', 'danger');
    if (!confirmed) return;
    try {
      const r = await salonFetch(`/api/salon/products/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Failed to delete');
      setProducts((p) => p.filter((x) => x.id !== id));
    } catch (e: any) { setError(e.message); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;

  return (
    <div>
      {confirmDialog}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Stock Alerts</h1>
          <p className="text-sm text-slate-500 mt-1">Monitor low stock and auto-alerts via WhatsApp</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => fetchProducts()} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all text-sm font-semibold">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button type="button" onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg transition-all text-sm font-semibold">
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-rose-50 text-rose-600 rounded-xl text-sm">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-rose-600 font-bold text-lg">{lowStock.length}</div>
          <p className="text-xs text-rose-500 mt-0.5">Low Stock</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-600 font-bold text-lg">{outOfStock.length}</div>
          <p className="text-xs text-red-500 mt-0.5">Out of Stock</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-green-600 font-bold text-lg">{okStock.length}</div>
          <p className="text-xs text-green-500 mt-0.5">In Stock</p>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Package className="w-16 h-16 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">No products yet</p>
          <p className="text-sm mt-1">Add your first product to start tracking inventory</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="font-semibold text-slate-700">All Products</h2>
          {products.map((p) => {
            const isLow = p.stock <= p.min_stock;
            return (
              <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between hover:shadow-sm transition-all group">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${p.stock === 0 ? 'bg-red-100' : isLow ? 'bg-amber-100' : 'bg-green-100'}`}>
                    <Package className={`w-5 h-5 ${p.stock === 0 ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-green-500'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-slate-700">{p.name}</p>
                    <p className="text-sm text-slate-400">
                      Stock: <span className={`font-semibold ${p.stock === 0 ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-green-500'}`}>{p.stock} {p.unit}</span>
                      {p.min_stock > 0 && <span className="ml-2">Min: {p.min_stock} {p.unit}</span>}
                      <span className="ml-2">| Rs.{p.price}</span>
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" onClick={() => openEdit(p)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => handleDelete(p.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowModal(false)}>
          <div onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-amber-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-800">{editing ? 'Edit Product' : 'Add Product'}</h2>
              <button type="button" onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" placeholder="Product name" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Price *</label>
                  <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="w-full px-4 py-2.5 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Unit</label>
                  <input type="text" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full px-4 py-2.5 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Stock</label>
                  <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })}
                    className="w-full px-4 py-2.5 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Min Stock</label>
                  <input type="number" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })}
                    className="w-full px-4 py-2.5 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
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
