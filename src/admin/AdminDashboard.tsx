import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { Crown, Store, Users, Calendar, TrendingUp, MapPin, CheckCircle, DollarSign, Building2, Loader2, Clock, Target, Sparkles, MessageSquare, Send, X, Scissors, BarChart3, Star } from 'lucide-react';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAdminAuth } from './AdminAuthContext';
import { useSocketContext } from '../context/SocketContext';
import { useT } from '../i18n';
import { DashboardCardSkeleton, TableRowSkeleton } from '../components/Skeleton';
import { Bar as BarMeter } from '../components/Bar';
import SalonLocationFilter from './SalonLocationFilter';

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
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  inactive: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
  suspended: 'bg-rose-500/15 text-rose-400 border-rose-500/20',
};

const statCards = [
  { label: 'Total Salons', key: 'totalSalons' as const, icon: Building2, gradient: 'from-indigo-500 to-indigo-600' },
  { label: 'Active Salons', key: 'activeSalons' as const, icon: Store, gradient: 'from-emerald-500 to-emerald-600' },
  { label: 'Barbers', key: 'totalBarbers' as const, icon: Users, gradient: 'from-violet-500 to-violet-600' },
  { label: 'Customers', key: 'totalCustomers' as const, icon: Users, gradient: 'from-pink-500 to-pink-600' },
  { label: 'Total Visits', key: 'totalVisits' as const, icon: TrendingUp, gradient: 'from-amber-500 to-amber-600' },
  { label: 'Visits Today', key: 'visitsToday' as const, icon: Clock, gradient: 'from-orange-500 to-orange-600' },
  { label: 'Conversion', key: 'conversionRate' as const, icon: Target, gradient: 'from-rose-500 to-rose-600', suffix: '%' },
  { label: 'Appointments', key: 'totalAppointments' as const, icon: Calendar, gradient: 'from-blue-500 to-blue-600' },
  { label: 'Revenue', key: 'totalRevenue' as const, icon: DollarSign, gradient: 'from-emerald-500 to-emerald-600', prefix: '₹' },
];

export function AdminDashboard({ isSuperAdmin }: { isSuperAdmin?: boolean }) {
  const { adminFetch } = useAdminAuth();
  const { socket } = useSocketContext();
  const t = useT();
  const [data, setData] = useState<DashboardData | null>(null);
  const [live, setLive] = useState<{ appointmentsToday: number; revenueToday: number; recent: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [salons, setSalons] = useState<any[]>([]);
  const [salonFilter, setSalonFilter] = useState('');
  const [leads, setLeads] = useState<any[]>([]);
  const [topBarbers, setTopBarbers] = useState<{ name: string; count: number }[]>([]);
  const [connectModal, setConnectModal] = useState<{ phone: string; name: string } | null>(null);
  const [connectMsg, setConnectMsg] = useState('');
  const [connectSending, setConnectSending] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        let url = '/api/admin/stats';
        if (salonFilter) url += `?salon_id=${salonFilter}`;
        const res = await adminFetch(url, { signal: ac.signal });
        if (!res.ok) throw new Error('Failed to load admin stats');
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        setError(err.message || 'Something went wrong');
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [salonFilter]);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const res = await adminFetch('/api/admin/leads', { signal: ac.signal });
        if (res.ok) { const d = await res.json(); if (Array.isArray(d)) setLeads(d.slice(0, 8)); }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.error('[AdminDashboard] Failed to fetch leads:', err);
      }
    })();
    return () => ac.abort();
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const res = await adminFetch('/api/admin/appointments', { signal: ac.signal });
        if (!res.ok) return;
        const list = await res.json();
        if (!Array.isArray(list)) return;
        const counts: Record<string, number> = {};
        for (const a of list) {
          const name = a.barber_name || a.barber?.name || 'Unassigned';
          counts[name] = (counts[name] || 0) + 1;
        }
        const ranked = Object.entries(counts)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 6);
        setTopBarbers(ranked);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.error('[AdminDashboard] Failed to load appointments:', err);
      }
    })();
    return () => ac.abort();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handler = (stats: any) => {
      setLive({ appointmentsToday: Number(stats?.appointmentsToday || 0), revenueToday: Number(stats?.revenueToday || 0), recent: Array.isArray(stats?.recent) ? stats.recent : [] });
      setData((prev) => {
        if (!prev) return prev;
        const todayStr = new Date().toISOString().slice(0, 10);
        let trend = Array.isArray(prev.bookingTrend) ? [...prev.bookingTrend] : [];
        const idx = trend.findIndex((x) => x.date === todayStr);
        if (idx >= 0) trend = trend.map((x, i) => (i === idx ? { ...x, bookings: Number(stats?.appointmentsToday || x.bookings) } : x));
        return {
          ...prev,
          totalSalons: stats?.totalSalons ?? prev.totalSalons,
          totalCustomers: stats?.totalCustomers ?? prev.totalCustomers,
          totalAppointments: stats?.appointmentsToday ?? prev.totalAppointments,
          totalRevenue: stats?.revenueToday ?? prev.totalRevenue,
          bookingTrend: trend,
        };
      });
    };
    socket.on('admin:stats', handler);
    return () => { socket.off('admin:stats', handler); };
  }, [socket]);

  const sendConnect = async () => {
    if (!connectModal || !connectMsg.trim() || connectSending) return;
    setConnectSending(true);
    try {
      const res = await adminFetch(`/api/admin/chats/${encodeURIComponent(connectModal.phone)}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: connectMsg.trim() }),
      });
      if (res.ok) setConnectModal(null);
    } catch (err) {
      console.error('[AdminDashboard] Failed to send connect message:', err);
    } finally { setConnectSending(false); }
  };

  if (loading) {
    return (
      <div className="space-y-8 p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-700/50 rounded-lg w-48 mb-2" />
          <div className="h-4 bg-slate-700/50 rounded w-64" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <DashboardCardSkeleton key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700/50 p-6 animate-pulse">
            <div className="h-5 bg-slate-700 rounded w-28 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRowSkeleton key={i} columns={4} />
              ))}
            </div>
          </div>
          <div className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700/50 p-6 animate-pulse">
            <div className="h-5 bg-slate-700 rounded w-28 mb-4" />
            <div className="h-48 bg-slate-700/50 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-rose-500/10 text-rose-400 px-6 py-4 rounded-2xl border border-rose-500/20 text-sm font-medium">
          {error || 'Unable to load dashboard'}
        </div>
      </div>
    );
  }

  const trend = Array.isArray(data.bookingTrend) ? data.bookingTrend : [];
  const maxBookings = Math.max(...trend.map((b) => b.bookings), 1);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            {isSuperAdmin ? <Crown className="w-6 h-6 text-amber-400" /> : <Sparkles className="w-6 h-6 text-indigo-400" />}
            Dashboard
          </h1>
          <p className={`text-sm mt-1 ${isSuperAdmin ? 'text-amber-400/80' : 'text-indigo-400/80'}`}>
            {isSuperAdmin ? 'Full platform overview' : 'Your assigned salons overview'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SalonLocationFilter salonFilter={salonFilter} setSalonFilter={setSalonFilter} salons={salons} setSalons={setSalons} adminFetch={adminFetch} />
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
            isSuperAdmin ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
          }`}>
            <div className={`w-2 h-2 rounded-full animate-pulse ${isSuperAdmin ? 'bg-amber-400' : 'bg-indigo-400'}`} />
            {isSuperAdmin ? 'Super Admin' : 'Admin'}
          </div>
          {live && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              LIVE · {live.appointmentsToday} {t('dashboard.appointments').toLowerCase()} · ₹{live.revenueToday.toLocaleString()}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          const value = data[stat.key] ?? 0;
          const display = stat.key === 'totalRevenue'
            ? `${stat.prefix}${Number(value).toLocaleString()}`
            : stat.suffix
              ? `${Number(value).toLocaleString()}${stat.suffix}`
              : Number(value).toLocaleString();
          return (
            <motion.div
              key={stat.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700/50 p-5 hover:border-slate-600/50 transition-all duration-300 hover:shadow-lg hover:shadow-slate-900/50"
            >
              <div className={`inline-flex p-2.5 rounded-xl bg-gradient-to-br ${stat.gradient} mb-3 shadow-sm`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{stat.label}</p>
              <p className="text-2xl font-bold text-white mt-1">{display}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700/50 overflow-hidden hover:shadow-lg hover:shadow-slate-900/50 transition-all duration-300">
          <div className="px-6 py-4 border-b border-slate-700/50">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Store className={`w-4 h-4 ${isSuperAdmin ? 'text-amber-400' : 'text-indigo-400'}`} />
              {t('dashboard.topSalons')}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-700/30 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Bookings</th>
                  <th className="px-6 py-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {data.topSalons.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">No salon data available</td>
                  </tr>
                ) : (
                  data.topSalons.map((salon, i) => (
                    <tr key={i} className="hover:bg-slate-700/20 transition-colors">
                      <td className="px-6 py-3.5 font-medium text-white whitespace-nowrap">{salon.name}</td>
                      <td className="px-6 py-3.5 text-slate-300 whitespace-nowrap">{salon.email}</td>
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[salon.status] || 'bg-slate-500/15 text-slate-400 border-slate-500/20'}`}>
                          {salon.status}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-slate-300 text-right whitespace-nowrap">{salon.bookings}</td>
                      <td className="px-6 py-3.5 text-slate-300 text-right whitespace-nowrap">₹{salon.revenue.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700/50 p-6 hover:shadow-lg hover:shadow-slate-900/50 transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">{t('dashboard.trend')}</h2>
            <TrendingUp className={`w-4 h-4 ${isSuperAdmin ? 'text-amber-400' : 'text-indigo-400'}`} />
          </div>
          {trend.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-500 text-sm">No trend data</div>
          ) : (
            <div className="flex items-end gap-1 h-48">
              {trend.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div className="absolute bottom-8 bg-slate-700 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none shadow-lg">
                    {day.date}: {day.bookings}
                  </div>
                  <div
                    className={`w-full rounded-t transition-all cursor-pointer ${
                      isSuperAdmin ? 'bg-amber-500/60 hover:bg-amber-400/80' : 'bg-indigo-500/60 hover:bg-indigo-400/80'
                    }`}
                    style={{ height: `${(day.bookings / maxBookings) * 100}%`, minHeight: day.bookings > 0 ? '4px' : '0' }}
                  />
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-500 mt-3 text-center">Last 30 days</p>
        </div>
      </div>

      {(() => {
        const apptData = trend.map((d) => ({ date: d.date, bookings: d.bookings }));
        const revenueData = data.topSalons.map((s) => ({ name: s.name, revenue: s.revenue }));
        const barberChartData = topBarbers.map((b) => ({ name: b.name, count: b.count }));
        const maxRevenue = Math.max(...data.topSalons.map((s) => s.revenue), 1);
        const maxBarber = Math.max(...topBarbers.map((b) => b.count), 1);
        const chartCard = (title: string, icon: ReactNode, body: ReactNode) => (
          <div className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700/50 p-6 hover:shadow-lg hover:shadow-slate-900/50 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">{icon}{title}</h2>
            </div>
            {body}
          </div>
        );
        return (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {chartCard(
              t('dashboard.appointments'),
              <Calendar className={`w-4 h-4 ${isSuperAdmin ? 'text-amber-400' : 'text-indigo-400'}`} />,
              apptData.length === 0 ? (
                <div className="flex items-center justify-center h-56 text-slate-500 text-sm">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={224}>
                  <BarChart data={apptData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, color: '#f1f5f9', fontSize: 12 }} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
                    <Bar dataKey="bookings" fill={isSuperAdmin ? '#f59e0b' : '#6366f1'} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )
            )}
            {chartCard(
              t('dashboard.topSalons'),
              <DollarSign className={`w-4 h-4 ${isSuperAdmin ? 'text-amber-400' : 'text-indigo-400'}`} />,
              revenueData.length === 0 ? (
                <div className="flex items-center justify-center h-56 text-slate-500 text-sm">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={224}>
                  <BarChart data={revenueData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                    <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} width={80} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, color: '#f1f5f9', fontSize: 12 }} cursor={{ fill: 'rgba(99,102,241,0.08)' }} formatter={(value) => `₹${Number(value).toLocaleString()}`} />
                    <Bar dataKey="revenue" fill={isSuperAdmin ? '#f59e0b' : '#6366f1'} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )
            )}
            {chartCard(
              t('dashboard.topBarbers'),
              <Scissors className={`w-4 h-4 ${isSuperAdmin ? 'text-amber-400' : 'text-indigo-400'}`} />,
              barberChartData.length === 0 ? (
                <div className="flex items-center justify-center h-56 text-slate-500 text-sm">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={224}>
                  <BarChart data={barberChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={48} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, color: '#f1f5f9', fontSize: 12 }} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
                    <Bar dataKey="count" fill={isSuperAdmin ? '#f59e0b' : '#6366f1'} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )
            )}
          </div>
        );
      })()}

      <div className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700/50 p-6 hover:shadow-lg hover:shadow-slate-900/50 transition-all duration-300">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <BarChart3 className={`w-4 h-4 ${isSuperAdmin ? 'text-amber-400' : 'text-indigo-400'}`} />
          {t('dashboard.salonPerf')}
        </h2>
        {data.topSalons.length === 0 ? (
          <p className="text-sm text-slate-500">No salon data available</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {data.topSalons.slice(0, 6).map((s) => (
              <BarMeter key={s.name} label={s.name} value={s.bookings} max={Math.max(...data.topSalons.map((x) => x.bookings), 1)} display={String(s.bookings)} color={isSuperAdmin ? 'var(--color-accent, #f59e0b)' : 'var(--color-primary, #6366f1)'} />
            ))}
          </div>
        )}
      </div>

      <div className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700/50 overflow-hidden hover:shadow-lg hover:shadow-slate-900/50 transition-all duration-300">
        <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <MessageSquare className={`w-4 h-4 ${isSuperAdmin ? 'text-amber-400' : 'text-indigo-400'}`} />
            {t('dashboard.recentActivity')}
          </h2>
          <span className="text-xs text-slate-500">Connect with new leads</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-700/30 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Salon</th>
                <th className="px-6 py-3">Time</th>
                <th className="px-6 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {leads.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-500">No recent visitors</td></tr>
              ) : leads.map((l: any, i: number) => (
                <tr key={l.id || i} className="hover:bg-slate-700/20 transition-colors">
                  <td className="px-6 py-3.5">
                    <span className="font-medium text-white">{l.customer_name || 'Guest'}</span>
                    {l.customer_phone && <span className="text-slate-500 ml-2">{l.customer_phone}</span>}
                  </td>
                  <td className="px-6 py-3.5 text-slate-300">{l.salon_name}</td>
                  <td className="px-6 py-3.5 text-slate-400 text-xs">
                    {l.visit_time ? format(new Date(l.visit_time), 'MMM d, HH:mm') : '-'}
                  </td>
                  <td className="px-6 py-3.5 text-center">
                    {l.customer_phone ? (
                      <button type="button" onClick={() => setConnectModal({ phone: l.customer_phone, name: l.customer_name || l.customer_phone })}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg hover:bg-indigo-500/20 transition-colors text-xs font-medium">
                        <MessageSquare className="w-3.5 h-3.5" /> Connect
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500">No phone</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {connectModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setConnectModal(null)}>
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Connect with {connectModal.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{connectModal.phone}</p>
              </div>
              <button type="button" onClick={() => setConnectModal(null)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <textarea value={connectMsg} onChange={e => setConnectMsg(e.target.value)}
              placeholder="Type your message..."
              rows={4}
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 resize-none" />
            <div className="flex gap-3 mt-4">
              <button type="button" onClick={() => setConnectModal(null)} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-medium">Cancel</button>
              <button type="button" onClick={sendConnect} disabled={!connectMsg.trim() || connectSending}
                className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                {connectSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send Message
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
