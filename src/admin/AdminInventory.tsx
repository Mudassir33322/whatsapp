import { useState, useEffect } from 'react';
import { Package, Store, Loader2, AlertTriangle } from 'lucide-react';

export function AdminInventory() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const hd = () => ({ Authorization: `Bearer ${localStorage.getItem('admin-token')}`, 'Content-Type': 'application/json' });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/products', { headers: hd() });
        if (res.ok) setProducts(await res.json());
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Inventory (All Salons)</h1>
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800/50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Salon</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Product</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Price</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Stock</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Min Stock</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Unit</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-slate-500 text-sm">No products found</td></tr>
            ) : products.map((p: any) => (
              <tr key={p.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
