import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Store, Users, Calendar, TrendingUp, MapPin, CheckCircle, DollarSign, Building2, Loader2, Clock } from 'lucide-react';

interface TopSalon {
  name: string;
  email: string;
  status: string;
  bookings: number;
  revenue: number;
}

interface BookingTrend {
  date: string;
  bookings: number;
}

interface DashboardData {
  totalSalons: number;
  activeSalons: number;
  totalBarbers: number;
  totalCustomers: number;
  totalAppointments: number;
  completedAppointments: number;
  totalRevenue: number;
  countries: number;
  cities: number;
  areas: number;
  totalVisits: number;
  visitsToday: number;
  conversionRate: number;
  topSalons: TopSalon[];
  bookingTrend: BookingTrend[];
}

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-400',
  inactive: 'bg-slate-500/20 text-slate-400',
  suspended: 'bg-rose-500/20 text-rose-400',
};

const statCards = [
  { label: 'Total Salons', key: 'totalSalons' as const, icon: Building2, color: 'from-indigo-500 to-indigo-600' },
  { label: 'Active Salons', key: 'activeSalons' as const, icon: Store, color: 'from-emerald-500 to-emerald-600' },
  { label: 'Barbers', key: 'totalBarbers' as const, icon: Users, color: 'from-violet-500 to-violet-600' },
  { label: 'Customers', key: 'totalCustomers' as const, icon: Users, color: 'from-pink-500 to-pink-600' },
  { label: 'Total Visits', key: 'totalVisits' as const, icon: TrendingUp, color: 'from-amber-500 to-amber-600' },
  { label: 'Visits Today', key: 'visitsToday' as const, icon: Clock, color: 'from-orange-500 to-orange-600' },
  { label: 'Conversion', key: 'conversionRate' as const, icon: CheckCircle, color: 'from-rose-500 to-rose-600', suffix: '%' },
  { label: 'Appointments', key: 'totalAppointments' as const, icon: Calendar, color: 'from-blue-500 to-blue-600' },
  { label: 'Revenue', key: 'totalRevenue' as const, icon: DollarSign, color: 'from-amber-500 to-amber-600', prefix: '₹' },
];

export function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('admin-token');
        const res = await fetch('/api/admin/stats', {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        if (!res.ok) throw new Error('Failed to load admin stats');
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || 'Something went wrong');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-rose-500/10 text-rose-400 px-6 py-4 rounded-xl border border-rose-500/20 text-sm font-medium">
          {error || 'Unable to load dashboard'}
        </div>
      </div>
    );
  }

  const maxBookings = Math.max(...data.bookingTrend.map((b) => b.bookings), 1);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-slate-400 mt-1">Platform overview at a glance</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          const value = data[stat.key];
          const display = stat.key === 'totalRevenue' ? `${stat.prefix}${value.toLocaleString()}` : value.toLocaleString();
          return (
            <motion.div
              key={stat.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-800 rounded-2xl border border-slate-700 p-5 hover:border-slate-600 transition-colors"
            >
              <div className={`inline-flex p-2.5 rounded-xl bg-gradient-to-br ${stat.color} mb-3`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{stat.label}</p>
              <p className="text-2xl font-bold text-white mt-1">{display}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">Top Salons</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-700/50 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Bookings</th>
                  <th className="px-6 py-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {data.topSalons.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">No salon data available</td>
                  </tr>
                ) : (
                  data.topSalons.map((salon, i) => (
                    <tr key={i} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-6 py-3.5 font-medium text-white whitespace-nowrap">{salon.name}</td>
                      <td className="px-6 py-3.5 text-slate-300 whitespace-nowrap">{salon.email}</td>
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[salon.status] || 'bg-slate-500/20 text-slate-400'}`}>
                          {salon.status}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-slate-300 text-right whitespace-nowrap">{salon.bookings}</td>
                      <td className="px-6 py-3.5 text-slate-300 text-right whitespace-nowrap">${salon.revenue.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Booking Trend</h2>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          {data.bookingTrend.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-500 text-sm">No trend data</div>
          ) : (
            <div className="flex items-end gap-1 h-48">
              {data.bookingTrend.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div className="absolute bottom-8 bg-slate-600 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                    {day.date}: {day.bookings}
                  </div>
                  <div
                    className="w-full rounded-t bg-indigo-500/80 hover:bg-indigo-400 transition-all cursor-pointer"
                    style={{ height: `${(day.bookings / maxBookings) * 100}%` }}
                  />
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-500 mt-3 text-center">Last 30 days</p>
        </div>
      </div>
    </div>
  );
}
