import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';

export function AdminFinances() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const hd = () => ({ Authorization: `Bearer ${localStorage.getItem('admin-token')}`, 'Content-Type': 'application/json' });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/finances', { headers: hd() });
        if (res.ok) setData(await res.json());
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>;

  const cards = [
    { label: 'Total Revenue', value: data?.revenue || 0, icon: TrendingUp, color: 'from-emerald-500 to-emerald-600', prefix: 'PKR ' },
    { label: 'Total Expenses', value: data?.expenses || 0, icon: TrendingDown, color: 'from-rose-500 to-rose-600', prefix: 'PKR ' },
    { label: 'Net Profit', value: data?.profit || 0, icon: DollarSign, color: 'from-indigo-500 to-indigo-600', prefix: 'PKR ' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Platform Finances</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((c) => (
          <div key={c.label} className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-slate-400">{c.label}</span>
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${c.color} flex items-center justify-center`}>
                <c.icon className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{c.prefix}{Number(c.value).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
