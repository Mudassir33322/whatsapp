import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Clock, Trophy, Loader2 } from 'lucide-react';
import { salonFetch } from './api';

interface RevenuePoint { date: string; revenue: number }
interface BookingPoint { date: string; count: number }
interface TopItem { name: string; count: number; revenue: number }
interface PeakHour { hour: number; count: number }
interface StatusDist { status: string; count: number }

interface AnalyticsData {
  revenueOverTime: RevenuePoint[];
  bookingsOverTime: BookingPoint[];
  topServices: TopItem[];
  topBarbers: TopItem[];
  peakHours: PeakHour[];
  statusDist: StatusDist[];
}

const PERIODS = [
  { label: '7 Days', value: '7d' },
  { label: '30 Days', value: '30d' },
  { label: '1 Year', value: '1y' },
];

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-500',
  pending: 'bg-amber-500',
  confirmed: 'bg-blue-500',
  cancelled: 'bg-red-500',
  in_progress: 'bg-indigo-500',
  no_show: 'bg-gray-500',
};

const STATUS_LABELS: Record<string, string> = {
  completed: 'Completed',
  pending: 'Pending',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  in_progress: 'In Progress',
  no_show: 'No Show',
};

const fmtCurrency = (n: number) => '₹' + n.toLocaleString('en-IN');
const maxVal = (arr: { count?: number; revenue?: number }[], key: 'count' | 'revenue') => Math.max(...arr.map((i) => i[key] ?? 0), 1);

function BarChart({ data, dataKey, color, label }: { data: { date?: string; hour?: number; revenue?: number; count?: number }[]; dataKey: 'revenue' | 'count'; color: string; label: string }) {
  const max = maxVal(data, dataKey);
  return (
    <div className="space-y-2">
      {data.map((item, i) => {
        const val = item[dataKey] ?? 0;
        const pct = (val / max) * 100;
        const key = item.date ?? item.hour ?? i;
        return (
          <div key={key} className="flex items-center gap-3 text-sm">
            <span className="w-24 shrink-0 text-gray-500 text-right truncate">{item.date ? item.date.slice(5) : `${item.hour}:00`}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
              <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
            </div>
            <span className="w-20 shrink-0 text-gray-900 font-medium text-right">{dataKey === 'revenue' ? fmtCurrency(val) : val}</span>
          </div>
        );
      })}
    </div>
  );
}

function TopTable({ items, icon: Icon, label }: { items: TopItem[]; icon: any; label: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
        <Icon className="w-5 h-5 text-indigo-600" />
        <h2 className="text-lg font-semibold text-gray-900">{label}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">Count</th>
              <th className="px-6 py-3">Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item) => (
              <tr key={item.name} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-3.5 font-medium text-gray-900">{item.name}</td>
                <td className="px-6 py-3.5 text-gray-700">{item.count}</td>
                <td className="px-6 py-3.5 text-gray-900 font-medium">{fmtCurrency(item.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ name, count }: { name: string; count: number }) {
  return (
    <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <div className={`w-3 h-3 rounded-full ${STATUS_COLORS[name] || 'bg-gray-400'}`} />
      <span className="flex-1 text-sm font-medium text-gray-700 capitalize">{STATUS_LABELS[name] || name}</span>
      <span className="text-lg font-bold text-gray-900">{count}</span>
    </div>
  );
}

export function SalonAnalytics() {
  const [period, setPeriod] = useState('7d');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await salonFetch(`/api/salon/analytics?period=${period}`, { signal: ac.signal });
        if (!res.ok) throw new Error('Failed to fetch analytics');
        setData(await res.json());
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        setError(err.message || 'Something went wrong');
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [period]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-red-50 text-red-700 px-6 py-4 rounded-xl border border-red-200 text-sm font-medium">
          {error || 'Unable to load analytics'}
        </div>
      </div>
    );
  }

  const empty = !data.revenueOverTime.length && !data.bookingsOverTime.length;

  if (empty) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <div className="flex gap-2">
            {PERIODS.map((p) => (
              <button type="button" key={p.value} onClick={() => setPeriod(p.value)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${period === p.value ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No analytics data available for this period</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <button type="button" key={p.value} onClick={() => setPeriod(p.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${period === p.value ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-gray-900">Revenue Over Time</h2>
          </div>
          {data.revenueOverTime.length ? <BarChart data={data.revenueOverTime} dataKey="revenue" color="bg-emerald-500" label="Revenue" />
            : <p className="text-gray-400 text-sm text-center py-8">No revenue data</p>}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Bookings Over Time</h2>
          </div>
          {data.bookingsOverTime.length ? <BarChart data={data.bookingsOverTime} dataKey="count" color="bg-blue-500" label="Bookings" />
            : <p className="text-gray-400 text-sm text-center py-8">No bookings data</p>}
        </div>

        <TopTable items={data.topServices} icon={Trophy} label="Top Services" />
        <TopTable items={data.topBarbers} icon={Trophy} label="Top Barbers" />

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900">Peak Hours</h2>
          </div>
          {data.peakHours.length ? <BarChart data={data.peakHours} dataKey="count" color="bg-purple-500" label="Count" />
            : <p className="text-gray-400 text-sm text-center py-8">No peak hours data</p>}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-rose-600" />
            <h2 className="text-lg font-semibold text-gray-900">Status Distribution</h2>
          </div>
          {data.statusDist.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.statusDist.map((s) => <StatusBadge key={s.status} name={s.status} count={s.count} />)}
            </div>
          ) : <p className="text-gray-400 text-sm text-center py-8">No status data</p>}
        </div>
      </div>
    </div>
  );
}
