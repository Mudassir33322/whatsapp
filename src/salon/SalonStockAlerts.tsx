import { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw, Loader2, Bell, CheckCircle2 } from 'lucide-react';
import { authHeaders } from './api';

interface Product {
  id: number;
  name: string;
  stock: number;
  min_stock: number;
  unit: string;
  price: number;
}

export function SalonStockAlerts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [alertSending, setAlertSending] = useState<number | null>(null);
  const [alertSent, setAlertSent] = useState('');

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/salon/products', { headers: authHeaders() });
      if (!r.ok) throw new Error('Failed to fetch');
      setProducts(await r.json());
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchProducts(); }, []);

  const lowStock = products.filter((p) => p.stock <= p.min_stock && p.stock > 0);
  const outOfStock = products.filter((p) => p.stock === 0);
  const okStock = products.filter((p) => p.stock > p.min_stock);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Stock Alerts</h1>
          <p className="text-sm text-slate-500 mt-1">Monitor low stock and auto-alerts via WhatsApp</p>
        </div>
        <button onClick={fetchProducts} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all text-sm font-semibold">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-rose-50 text-rose-600 rounded-xl text-sm">{error}</div>}
      {alertSent && <div className="mb-4 p-3 bg-green-50 text-green-600 rounded-xl text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {alertSent}</div>}

      <div className="grid grid-cols-3 gap-4 mb-6">
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

      {lowStock.length === 0 && outOfStock.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <CheckCircle2 className="w-16 h-16 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">All stocked up!</p>
          <p className="text-sm mt-1">No low stock alerts right now</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="font-semibold text-slate-700">Products Needing Attention</h2>
          {[...lowStock, ...outOfStock].map((p) => (
            <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between hover:shadow-sm transition-all">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${p.stock === 0 ? 'bg-red-100' : 'bg-amber-100'}`}>
                  <AlertTriangle className={`w-5 h-5 ${p.stock === 0 ? 'text-red-500' : 'text-amber-500'}`} />
                </div>
                <div>
                  <p className="font-medium text-slate-700">{p.name}</p>
                  <p className="text-sm text-slate-400">
                    Stock: <span className={`font-semibold ${p.stock === 0 ? 'text-red-500' : 'text-amber-500'}`}>{p.stock} {p.unit}</span>
                    {p.min_stock > 0 && <span className="ml-2">Min: {p.min_stock} {p.unit}</span>}
                    <span className="ml-2">| Rs.{p.price}</span>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
