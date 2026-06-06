import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Users,
  MessageSquare,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  MoreVertical,
  Zap,
  Loader2,
  Bot,
  AlertTriangle,
  TrendingUp
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

const StatCard = ({ title, value, subtitle, icon: Icon, color, loading }: any) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-2.5 rounded-xl ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      {subtitle !== undefined && (
        <div className={`flex items-center text-xs font-medium ${subtitle >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          {subtitle >= 0
            ? <ArrowUpRight className="w-3 h-3 mr-0.5" />
            : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
          {Math.abs(subtitle)}%
        </div>
      )}
    </div>
    <div>
      <p className="text-sm text-slate-500 font-medium">{title}</p>
      {loading ? (
        <Loader2 className="w-6 h-6 animate-spin text-slate-200 mt-1" />
      ) : (
        <h3 className="text-2xl font-bold mt-1 tracking-tight">{value}</h3>
      )}
    </div>
  </div>
);

export function Dashboard() {
  const { user } = useAuth();
  const [salons, setSalons] = useState<any[]>([]);
  const [selectedSalonId, setSelectedSalonId] = useState<string>('all');
  const [stats, setStats] = useState({
    customers: 0,
    bookings: 0,
    totalBookings: 0,
    totalRevenue: 0,
    lifetimeExpenses: 0,
    lifetimeProfit: 0,
    activeSessions: 0,
    chartData: [] as any[],
    servicePopularity: [] as any[],
    staffPerformance: [] as any[],
    lowStockAlerts: [] as string[],
    topService: 'N/A',
    topCustomer: 'N/A'
  });
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [timeRange, setTimeRange] = useState<'7d' | '30d'>('7d');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchSalons = async () => {
      try {
        const res = await fetch(`${API_URL}/api/salons`);
        const data = await res.json();
        setSalons(Array.isArray(data) ? data : []);
      } catch (err) { console.error(err); }
    };
    fetchSalons();
  }, []);

  useEffect(() => {
    let failCount = 0;
    let interval: ReturnType<typeof setInterval>;

    const fetchStats = async () => {
      try {
        const url = selectedSalonId === 'all' 
          ? `${API_URL}/api/stats` 
          : `${API_URL}/api/stats?salonId=${selectedSalonId}`;
        const res = await fetch(url);
        const data = await res.json();
        failCount = 0;
        setStats({
          customers: data.totalCustomers || 0,
          bookings: data.pendingBookings || 0,
          totalBookings: data.totalBookings || 0,
          totalRevenue: data.lifetimeRevenue || 0,
          lifetimeExpenses: data.lifetimeExpenses || 0,
          lifetimeProfit: data.lifetimeProfit || 0,
          activeSessions: data.activeSessions || 0,
          chartData: data.chartData || [],
          servicePopularity: data.servicePopularity || [],
          staffPerformance: data.staffPerformance || [],
          lowStockAlerts: data.lowStockAlerts || [],
          topService: data.topService || 'N/A',
          topCustomer: data.topCustomer || 'N/A'
        });
        setLoading(false);
      } catch (err) {
        failCount++;
        if (failCount <= 3) console.error('Failed to fetch stats:', err);
        setLoading(false);
      }
    };

    fetchStats();
    interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [selectedSalonId]);

  // Calculate profit margin % for display
  const profitMargin = stats.totalRevenue > 0
    ? +((stats.lifetimeProfit / stats.totalRevenue) * 100).toFixed(1)
    : 0;

  const expenseRatio = stats.totalRevenue > 0
    ? +((stats.lifetimeExpenses / stats.totalRevenue) * 100).toFixed(1)
    : 0;

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {getGreeting()}, {user?.displayName?.split(' ')[0] || 'Operator'} 👋
          </h2>
          <p className="text-slate-500 mt-1">
            {selectedSalonId === 'all' ? 'Platform-wide overview of all salons.' : `Daily overview for ${salons.find(s => String(s.id) === selectedSalonId)?.name}.`}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
             <label className="text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Viewing Mode</label>
             <select 
               value={selectedSalonId} 
               onChange={(e) => setSelectedSalonId(e.target.value)}
               className="bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-indigo-500"
             >
               <option value="all">🌍 Global (All Salons)</option>
               {salons.map(s => (
                 <option key={s.id} value={s.id}>🏠 {s.name} ({s.area})</option>
               ))}
             </select>
          </div>
          {stats.activeSessions > 0 ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-sm font-bold">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              WhatsApp Live
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 text-rose-700 border border-rose-100 rounded-xl text-sm font-bold">
              <div className="w-2 h-2 rounded-full bg-rose-500" />
              WhatsApp Offline
            </div>
          )}
        </div>
      </div>

      {/* Low Stock Alerts */}
      {stats.lowStockAlerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">Low Stock Alert!</p>
            <p className="text-sm text-amber-700 mt-0.5">{stats.lowStockAlerts.join(' • ')}</p>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Customers"
          value={stats.customers.toLocaleString()}
          subtitle={undefined}
          icon={Users}
          color="bg-indigo-50 text-indigo-600"
          loading={loading}
        />
        <StatCard
          title="Lifetime Bookings"
          value={stats.totalBookings.toLocaleString()}
          subtitle={undefined}
          icon={Bot}
          color="bg-purple-50 text-purple-600"
          loading={loading}
        />
        <StatCard
          title="Total Expenses"
          value={`Rs. ${stats.lifetimeExpenses.toLocaleString()}`}
          subtitle={expenseRatio > 0 ? -expenseRatio : 0}
          icon={ArrowDownRight}
          color="bg-rose-50 text-rose-600"
          loading={loading}
        />
        <StatCard
          title="Net Profit"
          value={`Rs. ${stats.lifetimeProfit.toLocaleString()}`}
          subtitle={profitMargin}
          icon={CheckCircle2}
          color="bg-emerald-50 text-emerald-600"
          loading={loading}
        />
      </div>

      {/* Quick Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pending Bookings</p>
          <p className="text-3xl font-black mt-1 text-indigo-600">{stats.bookings}</p>
          <p className="text-xs text-slate-400 mt-1">Confirmed + Pending</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Top Service</p>
          <p className="text-xl font-black mt-1 truncate">{stats.topService}</p>
          <p className="text-xs text-slate-400 mt-1">Most booked service</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Top Customer</p>
          <p className="text-xl font-black mt-1 truncate">{stats.topCustomer}</p>
          <p className="text-xs text-slate-400 mt-1">Most visits</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Revenue Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              <h3 className="font-bold text-lg">Revenue Analytics</h3>
            </div>
          </div>
          <div className="h-[300px] w-full" style={{ minHeight: '300px' }}>
            {mounted && <ResponsiveContainer width="100%" height="100%">
              {stats.chartData.length > 0 ? (
                <AreaChart data={stats.chartData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#colorRevenue)" />
                </AreaChart>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 text-sm font-medium">No revenue data yet</div>
              )}
            </ResponsiveContainer>}
          </div>
        </div>

        {/* Service Popularity */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-lg mb-8">Service Popularity</h3>
          <div className="h-[300px] w-full" style={{ minHeight: '300px' }}>
            {mounted && stats.servicePopularity.length > 0 ? <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.servicePopularity}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="count"
                >
                  {stats.servicePopularity.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer> : <div className="flex items-center justify-center h-full text-slate-400 text-sm font-medium">No service data yet</div>}
          </div>
        </div>
      </div>

      {/* Staff Performance */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-lg mb-8">Staff Performance (Revenue generated)</h3>
        <div className="h-[300px] w-full" style={{ minHeight: '300px' }}>
          {mounted && stats.staffPerformance.length > 0 ? <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.staffPerformance}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <Tooltip cursor={{fill: '#f8fafc'}} />
              <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer> : <div className="flex items-center justify-center h-full text-slate-400 text-sm font-medium">No staff data yet</div>}
        </div>
      </div>
    </div>
  );
}
