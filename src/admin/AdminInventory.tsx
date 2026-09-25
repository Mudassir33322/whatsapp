import { useState, useEffect, useMemo } from 'react';
import { Package, Store, Loader2, AlertTriangle, Search, Plus, Pencil, Trash2, X } from 'lucide-react';
import { useAdminAuth } from './AdminAuthContext';
import { EmptyState } from '../components/EmptyState';
import { useConfirm } from '../hooks/useConfirm';
import { Pagination } from '../components/Pagination';

export function AdminInventory() {
  const { adminFetch } = useAdminAuth();
  const { confirm, confirmDialog } = useConfirm();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [salonFilter, setSalonFilter] = useState('');
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', price: '', stock: '', min_stock: '', unit: 'piece', salon_id: '' });
  const [salons, setSalons] = useState<any[]>([]);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const [pRes, sRes] = await Promise.all([
          adminFetch('/api/admin/products', { signal: ac.signal }),
          adminFetch('/api/admin/salons', { signal: ac.signal }),
        ]);
        if (pRes.ok) setProducts(await pRes.json());
        if (sRes.ok) setSalons(await sRes.json());
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      } finally { setLoading(false); }
    })();
    return () => ac.abort();
  }, []);

  const salonNames = useMemo(() => [...new Set(products.map((p: any) => p.salon_name))].sort(), [products]);

  const filtered = useMemo(() => products.filter((p: any) => {
    if (salonFilter && p.salon_name !== salonFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [products, search, salonFilter]);

  const paginatedFiltered = useMemo(() =>
    filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE),
    [filtered, page]
  );

  useEffect(() => { setPage(1); }, [search, salonFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', price: '', stock: '', min_stock: '', unit: 'piece', salon_id: '' });
    setShowModal(true);
  };

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      name: p.name, price: String(p.price), stock: String(p.stock),
      min_stock: String(p.min_stock), unit: p.unit || 'piece',
      salon_id: String(p.salon_id || ''),
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name || !form.price || !form.salon_id) return;
    const stockVal = form.stock === '' ? 0 : +form.stock;
    const minStockVal = form.min_stock === '' ? 0 : +form.min_stock;
    if (isNaN(+form.price) || isNaN(stockVal) || isNaN(minStockVal)) return;
    try {
      const body = { ...form, price: +form.price, stock: stockVal, min_stock: minStockVal };
      if (editing) {
        const res = await adminFetch(`/api/admin/products/${editing.id}`, {
          method: 'PUT', body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Failed');
      } else {
        const res = await adminFetch('/api/admin/products', {
          method: 'POST', body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Failed');
      }
      setShowModal(false);
      const r = await adminFetch('/api/admin/products');
      if (r.ok) setProducts(await r.json());
    } catch (e: any) { alert(e.message); }
  };

  const deleteProduct = async (id: number) => {
    const confirmed = await confirm('Delete Product', 'Are you sure you want to delete this product? This action cannot be undone.', 'Delete');
    if (!confirmed) return;
    try {
      const res = await adminFetch(`/api/admin/products/${id}`, { method: 'DELETE' });
      if (res.ok) setProducts(prev => prev.filter((p: any) => p.id !== id));
    } catch (err) {
      console.error('[AdminInventory] Failed to delete product:', err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-700/50 rounded-lg w-32 mb-2" />
          <div className="h-4 bg-slate-700/50 rounded w-48" />
        </div>
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden animate-pulse">
          <div className="p-4 border-b border-slate-700">
            <div className="h-4 bg-slate-700 rounded w-full" />
          </div>
          <div className="space-y-1 p-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <div className="h-4 bg-slate-700 rounded w-24" />
                <div className="h-4 bg-slate-700 rounded w-28" />
                <div className="h-4 bg-slate-700 rounded w-16" />
                <div className="h-5 bg-slate-700 rounded w-12 text-center" />
                <div className="h-4 bg-slate-700 rounded w-12" />
                <div className="h-4 bg-slate-700 rounded w-16 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Inventory</h1>
        <div className="flex gap-3 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 w-56" />
          </div>
          <select value={salonFilter} onChange={(e) => setSalonFilter(e.target.value)} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">All Salons</option>
            {salonNames.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button type="button" onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all text-sm font-semibold">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </div>
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800/50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Salon</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Product</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Price</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Stock</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Min Stock</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Unit</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
             {filtered.length === 0 ? (
               <tr><td colSpan={7}><div className="px-6 py-8"><EmptyState icon={Package} title="No products found" description="Products will appear here when added" /></div></td></tr>
             ) : paginatedFiltered.map((p: any) => (
              <tr key={p.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 group">
                <td className="px-4 py-3"><span className="flex items-center gap-1.5 text-sm text-white"><Store className="w-3.5 h-3.5 text-slate-400" />{p.salon_name}</span></td>
                <td className="px-4 py-3"><span className="flex items-center gap-2 text-sm"><Package className="w-4 h-4 text-slate-400" /><span className="text-white">{p.name}</span></span></td>
                <td className="px-4 py-3 text-sm text-slate-300">PKR {p.price}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${p.stock <= p.min_stock ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    {p.stock <= p.min_stock && <AlertTriangle className="w-3 h-3" />}
                    {p.stock}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-sm text-slate-400">{p.min_stock}</td>
                <td className="px-4 py-3 text-center text-sm text-slate-400">{p.unit}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" onClick={() => openEdit(p)}
                      className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => deleteProduct(p.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
            </tbody>
          </table>
          </div>
          <div className="border-t border-slate-700">
            <Pagination page={page} totalPages={Math.ceil(filtered.length / ITEMS_PER_PAGE)} onPageChange={setPage} />
          </div>
        </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowModal(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">{editing ? 'Edit Product' : 'Add Product'}</h2>
              <button type="button" onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-white rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Salon</label>
                <select value={form.salon_id} onChange={(e) => setForm({ ...form, salon_id: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select Salon</option>
                  {salons.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Price</label>
                  <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Stock</label>
                  <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Min Stock</label>
                  <input type="number" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Unit</label>
                  <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="piece">Piece</option>
                    <option value="bottle">Bottle</option>
                    <option value="pack">Pack</option>
                    <option value="box">Box</option>
                    <option value="ml">ML</option>
                    <option value="ltr">Liter</option>
                    <option value="kg">KG</option>
                    <option value="g">Gram</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 border border-slate-600 text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-700 transition-all">Cancel</button>
              <button type="button" onClick={save}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-all">
                {editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
