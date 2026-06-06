import { useState, useEffect } from 'react';
import { Package, Plus, Pencil, Trash2, X, Loader2, AlertTriangle } from 'lucide-react';
import { authHeaders } from './api';

interface Product { id: number; name: string; price: number; stock: number; min_stock: number; unit: string; }

export function SalonInventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', price: '', stock: '', min_stock: '', unit: 'pcs' });

  const fetchAll = async () => {
    try {
      const r = await fetch('/api/salon/products', { headers: authHeaders() });
      if (!r.ok) throw new Error('Failed to fetch');
      setProducts(await r.json());
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const saveProduct = async () => {
    if (!form.name.trim() || !form.price) return;
    setSaving(true);
    try {
      const body = { id: editing?.id, name: form.name, price: Number(form.price), stock: Number(form.stock) || 0, min_stock: Number(form.min_stock) || 0, unit: form.unit };
      const r = await fetch('/api/salon/products', { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });
      if (!r.ok) throw new Error('Failed to save');
      await fetchAll();
      setShowForm(false); setEditing(null); setForm({ name: '', price: '', stock: '', min_stock: '', unit: 'pcs' });
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const delProduct = async (id: number) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      const r = await fetch(`/api/salon/products/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (!r.ok) throw new Error('Failed to delete');
      setProducts((p) => p.filter((pr) => pr.id !== id));
    } catch (e: any) { setError(e.message); }
  };

  const edit = (p: Product) => {
    setForm({ name: p.name, price: String(p.price), stock: String(p.stock), min_stock: String(p.min_stock), unit: p.unit });
    setEditing(p); setShowForm(true);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;

  const lowStock = products.filter((p) => p.stock <= p.min_stock);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Inventory</h1>
          <p className="text-sm text-slate-500 mt-1">Track products, stock levels, and pricing</p>
        </div>
        <button onClick={() => { setEditing(null); setForm({ name: '', price: '', stock: '', min_stock: '', unit: 'pcs' }); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-sm font-semibold">
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-rose-50 text-rose-600 rounded-xl text-sm">{error}</div>}

      {lowStock.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-sm text-amber-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span><strong>{lowStock.length}</strong> product(s) low on stock: {lowStock.map((p) => `${p.name} (${p.stock} ${p.unit})`).join(', ')}</span>
        </div>
      )}

      {showForm && (
        <div className="mb-6 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-700">{editing ? 'Edit Product' : 'New Product'}</h3>
            <button onClick={() => setShowForm(false)} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Product name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Price (PKR)</label>
              <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="0" type="number" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Stock</label>
              <input value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="0" type="number" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Min Stock Alert</label>
              <input value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="0" type="number" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Unit</label>
              <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                <option value="pcs">Pieces</option>
                <option value="bottle">Bottle</option>
                <option value="pack">Pack</option>
                <option value="ml">ml</option>
                <option value="ltr">Liter</option>
                <option value="kg">Kg</option>
                <option value="gm">Gram</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-all">Cancel</button>
            <button onClick={saveProduct} disabled={saving || !form.name.trim() || !form.price} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all">
              {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Product</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Price</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Stock</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Min Stock</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Unit</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm">No products yet</td></tr>
            ) : products.map((p) => (
              <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-slate-400" />
                    <span className="font-medium text-slate-700 text-sm">{p.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">PKR {p.price}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${p.stock <= p.min_stock ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {p.stock <= p.min_stock && <AlertTriangle className="w-3 h-3" />}
                    {p.stock}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-sm text-slate-500">{p.min_stock}</td>
                <td className="px-4 py-3 text-center text-sm text-slate-500">{p.unit}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => edit(p)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => delProduct(p.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
