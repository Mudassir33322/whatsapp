import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { authHeaders } from './api';

export function SalonFinances() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/salon/finances', { headers: authHeaders() });
        if (!r.ok) throw new Error('Failed to fetch');
        setData(await r.json());
      } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;

  const cards = [
    { label: 'Total Revenue', value: data?.revenue || 0, icon: TrendingUp, color: 'from-emerald-500 to-emerald-600', prefix: 'PKR ' },
    { label: 'Total Expenses', value: data?.expenses || 0, icon: TrendingDown, color: 'from-rose-500 to-rose-600', prefix: 'PKR ' },
    { label: 'Net Profit', value: data?.profit || 0, icon: DollarSign, color: 'from-indigo-500 to-indigo-600', prefix: 'PKR ' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Finances</h1>
          <p className="text-sm text-slate-500 mt-1">Revenue, expenses, and profit overview</p>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-rose-50 text-rose-600 rounded-xl text-sm">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-slate-500">{c.label}</span>
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${c.color} flex items-center justify-center`}>
                <c.icon className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-800">{c.prefix}{Number(c.value).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
