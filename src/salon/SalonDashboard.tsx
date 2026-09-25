import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Calendar, CheckCircle, Clock, Users, TrendingUp, Scissors, Loader2, DollarSign, Sparkles, PhoneCall, ArrowRight } from 'lucide-react';
import { salonFetch } from './api';

interface DashboardData {
  todayBookings: number;
  todayCompleted: number;
  todayPending: number;
  totalBarbers: number;
  totalCustomers: number;
  totalAppointments: number;
  todayRevenue: number;
  todaySchedule: Array<{
    id: number;
    appointment_time: string;
    barber_name: string;
    service_name: string;
    customer_name: string;
    customer_phone: string;
    status: string;
    token: string;
  }>;
  recentLeads: Array<{
    id: number;
    customer_phone: string;
    customer_name: string;
    barber_name: string;
    visit_time: string;
    last_status?: string;
    last_active?: string;
  }>;
}

const statusStyles: Record<string, string> = {
  confirmed: 'bg-blue-100 text-blue-700 border-blue-200',
  in_progress: 'bg-amber-100 text-amber-700 border-amber-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const statusLabels: Record<string, string> = {
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  completed: 'Completed',
};

export function SalonDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const res = await salonFetch('/api/salon/dashboard', { signal: ac.signal });
        if (!res.ok) throw new Error('Failed to fetch dashboard data');
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
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-rose-50 text-rose-700 px-6 py-4 rounded-2xl border border-rose-200 text-sm font-medium shadow-sm">
          {error || 'Unable to load dashboard'}
        </div>
      </div>
    );
  }

  const stats = [
    { label: "Today's Bookings", value: data.todayBookings, icon: Calendar, gradient: 'from-amber-500 to-orange-500' },
    { label: 'Completed', value: data.todayCompleted, icon: CheckCircle, gradient: 'from-emerald-500 to-green-500' },
    { label: 'Pending', value: data.todayPending, icon: Clock, gradient: 'from-orange-500 to-red-500' },
    { label: 'Total Barbers', value: data.totalBarbers, icon: Scissors, gradient: 'from-violet-500 to-purple-500' },
    { label: 'Total Customers', value: data.totalCustomers, icon: Users, gradient: 'from-blue-500 to-amber-500' },
    { label: "Today's Revenue", value: `₹${data.todayRevenue}`, icon: DollarSign, gradient: 'from-emerald-500 to-teal-500' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-500" />
            Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">Aaj ka salon overview</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-white/60 px-3 py-2 rounded-full border border-amber-100">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Live
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white/80 backdrop-blur rounded-2xl border border-amber-100/50 p-5 flex items-center gap-4 hover:shadow-lg hover:shadow-amber-100/50 transition-all duration-300"
            >
              <div className={`bg-gradient-to-br ${stat.gradient} rounded-xl p-3 text-white shrink-0 shadow-sm`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide truncate">{stat.label}</p>
                <p className="text-xl font-bold text-slate-800 mt-0.5">{stat.value}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/80 backdrop-blur rounded-2xl border border-amber-100/50 overflow-hidden hover:shadow-lg hover:shadow-amber-100/50 transition-all duration-300"
        >
          <div className="px-6 py-4 border-b border-amber-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-amber-600" />
              Live WhatsApp Leads
            </h2>
            <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">Real-time</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-amber-50/50 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-3">Time</th>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-50">
                {data.recentLeads.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-400 text-sm">No visitors tracked yet</td>
                  </tr>
                ) : (
                  data.recentLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="px-6 py-3.5 text-slate-500 whitespace-nowrap text-xs">
                        {new Date(lead.visit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-6 py-3.5">
                        <div>
                          <p className="font-medium text-slate-800">{lead.customer_name || 'Anonymous'}</p>
                          <p className="text-xs text-slate-400">+{lead.customer_phone}</p>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 rounded-lg text-[10px] font-semibold border border-amber-200">
                          {lead.last_status || 'Browsing'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <a
                          href={`https://wa.me/${encodeURIComponent(lead.customer_phone)}?text=${encodeURIComponent(`Hello ${lead.customer_name || ''}!`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
                        >
                          <PhoneCall className="w-3 h-3" />
                          Contact
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-white/80 backdrop-blur rounded-2xl border border-amber-100/50 overflow-hidden hover:shadow-lg hover:shadow-amber-100/50 transition-all duration-300"
        >
          <div className="px-6 py-4 border-b border-amber-100">
            <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-600" />
              Today's Schedule
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-amber-50/50 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-3">Time</th>
                  <th className="px-6 py-3">Barber</th>
                  <th className="px-6 py-3">Service</th>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-50">
                {data.todaySchedule.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400 text-sm">No appointments for today</td>
                  </tr>
                ) : (
                  data.todaySchedule.map((appt) => (
                    <tr key={appt.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="px-6 py-3.5 font-medium text-slate-800 whitespace-nowrap text-xs">{appt.appointment_time}</td>
                      <td className="px-6 py-3.5 text-slate-700 whitespace-nowrap text-xs">{appt.barber_name}</td>
                      <td className="px-6 py-3.5 text-slate-600 whitespace-nowrap text-xs">{appt.service_name}</td>
                      <td className="px-6 py-3.5 text-slate-700 whitespace-nowrap text-xs">{appt.customer_name}</td>
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusStyles[appt.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {statusLabels[appt.status] || appt.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
