import { useState, useEffect } from 'react';
import { Calendar, CheckCircle, Clock, Users, TrendingUp, Scissors, Loader2 } from 'lucide-react';

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
  confirmed: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-amber-100 text-amber-800',
  completed: 'bg-green-100 text-green-800',
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
    (async () => {
      try {
        const headers = {
          Authorization: `Bearer ${localStorage.getItem('salon-token')}`,
          'Content-Type': 'application/json',
        };
        const res = await fetch('/api/salon/dashboard', { headers });
        if (!res.ok) throw new Error('Failed to fetch dashboard data');
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
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-red-50 text-red-700 px-6 py-4 rounded-xl border border-red-200 text-sm font-medium">
          {error || 'Unable to load dashboard'}
        </div>
      </div>
    );
  }

  const stats = [
    { label: "Today's Bookings", value: data.todayBookings, icon: Calendar, color: 'bg-indigo-500' },
    { label: 'Today Completed', value: data.todayCompleted, icon: CheckCircle, color: 'bg-green-500' },
    { label: 'Today Pending', value: data.todayPending, icon: Clock, color: 'bg-amber-500' },
    { label: 'Total Barbers', value: data.totalBarbers, icon: Scissors, color: 'bg-purple-500' },
    { label: 'Total Customers', value: data.totalCustomers, icon: Users, color: 'bg-pink-500' },
    { label: "Today's Revenue", value: `₹${data.todayRevenue}`, icon: TrendingUp, color: 'bg-emerald-500' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Salon Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
              <div className={`${stat.color} rounded-xl p-3 text-white shrink-0`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">{stat.label}</p>
                <p className="text-xl font-bold text-gray-900 mt-0.5">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            Recent WhatsApp Visitors (Leads)
          </h2>
          <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded-full uppercase">Real-time Tracking</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3">Time</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Phone</th>
                <th className="px-6 py-3">Current Status</th>
                <th className="px-6 py-3">Interested In</th>
                <th className="px-6 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.recentLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">No visitors tracked yet</td>
                </tr>
              ) : (
                data.recentLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3.5 text-gray-500 whitespace-nowrap">
                      {new Date(lead.visit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-3.5 font-medium text-gray-900">{lead.customer_name || 'Anonymous'}</td>
                    <td className="px-6 py-3.5 text-indigo-600 font-medium">
                      <a href={`https://wa.me/${lead.customer_phone}`} target="_blank" rel="noopener noreferrer">
                        +{lead.customer_phone}
                      </a>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-100">
                        {lead.last_status || 'Browsing'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-gray-700">
                      {lead.barber_name ? `Viewing Barber: ${lead.barber_name}` : 'Viewing Salon Profile'}
                    </td>
                    <td className="px-6 py-3.5">
                      <a 
                        href={`https://wa.me/${lead.customer_phone}?text=Hello ${lead.customer_name || ''}, hum ne dekha aap humara salon profile dekh rahe thay. Kya hum aapki koi madad kar sakte hain?`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider"
                      >
                        Contact Now
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Today's Schedule</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3">Time</th>
                <th className="px-6 py-3">Barber</th>
                <th className="px-6 py-3">Service</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.todaySchedule.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-400">No appointments scheduled for today</td>
                </tr>
              ) : (
                data.todaySchedule.map((appt) => (
                  <tr key={appt.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-gray-900 whitespace-nowrap">{appt.appointment_time}</td>
                    <td className="px-6 py-3.5 text-gray-700 whitespace-nowrap">{appt.barber_name}</td>
                    <td className="px-6 py-3.5 text-gray-700 whitespace-nowrap">{appt.service_name}</td>
                    <td className="px-6 py-3.5 text-gray-700 whitespace-nowrap">{appt.customer_name}</td>
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[appt.status] || 'bg-gray-100 text-gray-800'}`}>
                        {statusLabels[appt.status] || appt.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
