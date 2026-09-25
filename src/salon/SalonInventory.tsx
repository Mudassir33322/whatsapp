import { useState, useEffect, useMemo } from 'react';
import { Package, Plus, Pencil, Trash2, X, Loader2, AlertTriangle, Search } from 'lucide-react';
import { salonFetch } from './api';
import { EmptyState } from '../components/EmptyState';
import { useConfirm } from '../hooks/useConfirm';

interface Product { id: number; name: string; price: number; stock: number; min_stock: number; unit: string; }

export function SalonInventory() {
  const { confirm, confirmDialog } = useConfirm();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', price: '', stock: '', min_stock: '', unit: 'pcs' });
  const [search, setSearch] = useState('');

  const fetchAll = async (signal?: AbortSignal) => {
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
    fetchAll(ac.signal);
    return () => ac.abort();
  }, []);

  const saveProduct = async () => {
    if (!form.name.trim() || !form.price) return;
    const price = Number(form.price);
    const stock = Number(form.stock) || 0;
    const min_stock = Number(form.min_stock) || 0;
    if (price <= 0) { setError('Price must be greater than 0'); return; }
    if (stock < 0) { setError('Stock cannot be negative'); return; }
    if (min_stock < 0) { setError('Min stock cannot be negative'); return; }
    setSaving(true);
    try {
      const body = { name: form.name, price, stock, min_stock, unit: form.unit };
      const url = editing ? `/api/salon/products/${editing.id}` : '/api/salon/products';
      const method = editing ? 'PUT' : 'POST';
      const r = await salonFetch(url, { method, body: JSON.stringify(body) });
      if (!r.ok) throw new Error('Failed to save');
      await fetchAll();
      setShowForm(false); setEditing(null); setForm({ name: '', price: '', stock: '', min_stock: '', unit: 'pcs' });
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const delProduct = async (id: number) => {
    const confirmed = await confirm('Delete Product', 'Are you sure you want to delete this product? Stock history will be lost.', 'Delete', 'danger');
    if (!confirmed) return;
    try {
      const r = await salonFetch(`/api/salon/products/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Failed to delete');
      setProducts((p) => p.filter((pr) => pr.id !== id));
    } catch (e: any) { setError(e.message); }
  };

  const edit = (p: Product) => {
    setForm({ name: p.name, price: String(p.price), stock: String(p.stock), min_stock: String(p.min_stock), unit: p.unit });
    setEditing(p); setShowForm(true);
  };

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q));
  }, [products, search]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;

  const lowStock = products.filter((p) => p.stock <= p.min_stock);

  return (
    <div>
      {confirmDialog}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Inventory</h1>
          <p className="text-sm text-slate-500 mt-1">Track products, stock levels, and pricing</p>
        </div>
        <button type="button" onClick={() => { setEditing(null); setForm({ name: '', price: '', stock: '', min_stock: '', unit: 'pcs' }); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-sm font-semibold">
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

      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products..." className="w-full max-w-sm pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white" />
      </div>

      {showForm && (
        <div className="mb-6 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-700">{editing ? 'Edit Product' : 'New Product'}</h3>
            <button type="button" onClick={() => setShowForm(false)} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Product name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Price (PKR)</label>
              <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="0" type="number" min="0" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Stock</label>
              <input value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="0" type="number" min="0" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Min Stock Alert</label>
              <input value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="0" type="number" min="0" />
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
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-all">Cancel</button>
            <button type="button" onClick={saveProduct} disabled={saving || !form.name.trim() || !form.price} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all">
              {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
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
            {filteredProducts.length === 0 ? (
              <tr><td colSpan={6}><div className="px-6 py-8"><EmptyState icon={Package} title={search ? 'No products match your search' : 'No products yet'} description={search ? 'Try adjusting your search terms' : 'Add your first product to get started'} /></div></td></tr>
            ) : filteredProducts.map((p) => (
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
                    <button type="button" onClick={() => edit(p)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"><Pencil className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => delProduct(p.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
