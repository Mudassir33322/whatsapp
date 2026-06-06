import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  CheckCircle,
  Trash2,
  MessageSquare,
  CalendarPlus,
  Users,
  Clock,
  MapPin,
  Loader2,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Edit2,
  X,
  CheckCircle2,
  ArrowRight,
  Briefcase
} from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../context/AuthContext';
import { 
  format, 
  isToday, 
  isSameDay, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  addMonths, 
  subMonths,
  isSameMonth,
  parseISO
} from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { API_URL } from '../config';

interface Appointment {
  id: string;
  customerName: string;
  customerPhone: string;
  serviceType: string;
  appointmentTime: any;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  userId: string;
  date: string;
  time: string;
  staffId?: string;
  staffName?: string;
}

export function Bookings() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Appointment | null>(null);
  const { onMessage } = useSocket(user?.uid || '');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    service: 'Haircut',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
    staffId: ''
  });

  const fetchBookings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/bookings`);
      const data = await res.json();
      const mapped = data.map((b: any) => ({
        id: b.id,
        customerName: b.customerName,
        customerPhone: b.phone,
        serviceType: b.service,
        status: b.status.toLowerCase(),
        date: b.date,
        time: b.time,
        appointmentTime: { toDate: () => {
          const d = b.date.toLowerCase();
          if (d === 'today' || d === 'aj' || d === 'now') {
            return new Date(`${format(new Date(), 'yyyy-MM-dd')}T${b.time || '00:00'}`);
          }
          if (d === 'tomorrow' || d === 'kal') {
            const date = new Date();
            date.setDate(date.getDate() + 1);
            return new Date(`${format(date, 'yyyy-MM-dd')}T${b.time || '00:00'}`);
          }
          try {
             // Handle yyyy-MM-dd
             const parsed = parseISO(b.date);
             if (!isNaN(parsed.getTime())) return parsed;
             return new Date(b.date);
          } catch(e) {
             return new Date();
          }
        }}
      }));
      setAppointments(mapped);
      
      const staffRes = await fetch(`${API_URL}/api/staff`);
      setStaff(await staffRes.json());
      
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
    
    const unsub = onMessage((data) => {
      // If a new booking was confirmed by the bot, refresh
      if (data.text.includes('Confirmed') || data.text.includes('Booking')) {
        fetchBookings();
      }
    });

    return () => { if (unsub) unsub(); };
  }, [onMessage]);

  const handleOpenEdit = (apt: Appointment) => {
    setEditingBooking(apt);
    setFormData({
      name: apt.customerName,
      phone: apt.customerPhone,
      service: apt.serviceType,
      date: apt.date,
      time: apt.time,
      staffId: apt.staffId || ''
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingBooking(null);
    setFormData({
      name: '',
      phone: '',
      service: 'Haircut',
      date: format(new Date(), 'yyyy-MM-dd'),
      time: '09:00',
      staffId: ''
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Cancel this booking?')) return;
    try {
      await fetch(`${API_URL}/api/bookings/${id}`, { method: 'DELETE' });
      setAppointments(prev => prev.filter(a => a.id !== id));
    } catch (error) {
      console.error('Failed to delete booking', error);
    }
  };

  const handleStatusUpdate = async (id: string, status: Appointment['status']) => {
    try {
      let amount = '0';
      if (status === 'completed') {
        const input = prompt('Enter payment amount received for this service (Rs):', '1000');
        if (input === null) return; // Cancelled prompt
        amount = input;
        
        await fetch(`${API_URL}/api/revenue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId: id, amount: Number(amount), date: new Date().toISOString() })
        });
      }
      
      const capitalized = status.charAt(0).toUpperCase() + status.slice(1);
      await fetch(`${API_URL}/api/bookings/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: capitalized })
      });
      
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    } catch (error) {
      console.error('Failed to update status', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingBooking ? `${API_URL}/api/bookings/${editingBooking.id}` : `${API_URL}/api/bookings`;
      const method = editingBooking ? 'PUT' : 'POST';
      
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: formData.name,
          phone: formData.phone,
          service: formData.service,
          date: formData.date,
          time: formData.time,
          staffId: formData.staffId,
          staffName: staff.find(s => s.id === formData.staffId)?.name || ''
        })
      });
      await fetchBookings();
      handleCloseModal();
    } catch (error) {
      console.error('Failed to save booking', error);
    }
  };

  // Calendar logic
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const dayHasBookings = (day: Date) => {
    return appointments.some(apt => {
        try {
            const aptDate = new Date(apt.date);
            return isSameDay(aptDate, day);
        } catch(e) {
            return false;
        }
    });
  };

  const filteredAppointments = appointments.filter(apt => {
    try {
        // Use the same logic as appointmentTime.toDate() for consistency
        const d = apt.date.toLowerCase();
        let aptDate: Date;
        if (d === 'today' || d === 'aj' || d === 'now') {
          aptDate = new Date();
        } else if (d === 'tomorrow' || d === 'kal') {
          aptDate = new Date();
          aptDate.setDate(aptDate.getDate() + 1);
        } else {
          aptDate = parseISO(apt.date);
          if (isNaN(aptDate.getTime())) aptDate = new Date(apt.date);
        }
        return isSameDay(aptDate, selectedDate);
    } catch(e) {
        return false;
    }
  });

  return (
    <div className="space-y-8 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Salon Schedule</h2>
          <p className="text-slate-500 mt-1">Manage your appointments and daily tasks effortlessly.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 font-bold active:scale-95"
          >
            <Plus className="w-5 h-5" />
            New Appointment
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Left Column: Calendar & Quick Stats */}
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm overflow-hidden relative">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{format(currentMonth, 'MMMM')}</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{format(currentMonth, 'yyyy')}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={prevMonth} className="p-2 hover:bg-slate-50 rounded-xl border border-slate-100 transition-colors">
                  <ChevronLeft className="w-5 h-5 text-slate-600" />
                </button>
                <button onClick={nextMonth} className="p-2 hover:bg-slate-50 rounded-xl border border-slate-100 transition-colors">
                  <ChevronRight className="w-5 h-5 text-slate-600" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center mb-4">
              {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
                <span key={d} className="text-[10px] font-black text-slate-400 uppercase">{d}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {calendarDays.map((day, i) => {
                const isSelected = isSameDay(day, selectedDate);
                const isCurrentMonth = isSameMonth(day, monthStart);
                const hasBookings = dayHasBookings(day);
                const isTodayDate = isToday(day);

                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(day)}
                    className={`
                      relative group h-8 w-8 flex flex-col items-center justify-center rounded-lg text-[10px] font-bold transition-all mx-auto
                      ${isSelected ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 z-10 scale-105' : 'text-slate-600 hover:bg-slate-50'}
                      ${!isCurrentMonth && !isSelected ? 'opacity-20' : ''}
                      ${isTodayDate && !isSelected ? 'ring-1 ring-indigo-100 bg-indigo-50/30' : ''}
                    `}
                  >
                    <span>{format(day, 'd')}</span>
                    {hasBookings && (
                      <div className={`absolute bottom-1 w-0.5 h-0.5 rounded-full ${isSelected ? 'bg-white' : 'bg-indigo-500'}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Day Task Card */}
          <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:rotate-12 transition-transform">
               <CheckCircle2 className="w-20 h-20" />
            </div>
            <h4 className="text-sm font-bold text-indigo-300 uppercase tracking-widest mb-1">Daily Goal</h4>
            <p className="text-2xl font-bold">
                {filteredAppointments.filter(a => a.status === 'completed').length} / {filteredAppointments.length} Bookings
            </p>
            <div className="mt-6 h-2 bg-white/10 rounded-full overflow-hidden">
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: `${filteredAppointments.length > 0 ? (filteredAppointments.filter(a => a.status === 'completed').length / filteredAppointments.length) * 100 : 0}%` }}
                 className="h-full bg-indigo-500" 
               />
            </div>
            <p className="text-[10px] mt-4 text-slate-400 font-medium">Keep going! You're doing great today.</p>
          </div>
        </div>

        {/* Right Column: Appointment List */}
        <div className="xl:col-span-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100">
                  <CalendarIcon className="w-6 h-6 text-indigo-600" />
               </div>
               <div>
                  <h3 className="text-xl font-bold text-slate-900">{format(selectedDate, 'eeee, MMMM do')}</h3>
                  <p className="text-sm text-slate-400 font-medium">{filteredAppointments.length} appointments scheduled</p>
               </div>
            </div>
          </div>

          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <Loader2 className="w-10 h-10 animate-spin mb-4" />
                  <p className="text-sm font-medium">Synchronizing schedule...</p>
                </div>
              ) : filteredAppointments.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-24 text-slate-400 bg-white border-2 border-dashed border-slate-100 rounded-[40px]"
                >
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                    <CalendarPlus className="w-10 h-10 opacity-20" />
                  </div>
                  <h4 className="text-lg font-bold text-slate-800">No appointments for this day</h4>
                  <p className="text-sm mt-1 max-w-xs text-center">Relax! You have a clear schedule. Or click "New Appointment" to add one manually.</p>
                </motion.div>
              ) : (
                filteredAppointments.map((apt) => (
                  <motion.div
                    layout
                    key={apt.id}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className={`bg-white p-6 rounded-[32px] border transition-all flex flex-col md:flex-row md:items-center gap-6 group hover:shadow-xl hover:shadow-indigo-500/5 ${apt.status === 'completed' ? 'border-emerald-100 opacity-75' : 'border-slate-100'}`}
                  >
                    <div className="flex items-center gap-6 flex-1">
                        <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center shrink-0 transition-colors ${apt.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-900'}`}>
                            <span className="text-lg font-black">{apt.time.split(' ')[0]}</span>
                            <span className="text-[10px] font-black uppercase tracking-tighter opacity-50">{apt.time.split(' ')[1] || 'PM'}</span>
                        </div>
                        
                        <div className="min-w-0">
                            <h4 className="text-lg font-bold text-slate-900 truncate">{apt.customerName}</h4>
                            <div className="flex items-center gap-4 mt-1">
                                <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                    <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                                    {apt.serviceType}
                                </span>
                                <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                    <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                                    {apt.customerPhone.split('@')[0]}
                                </span>
                                {apt.staffName && (
                                  <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                      <Briefcase className="w-3.5 h-3.5 text-amber-400" />
                                      {apt.staffName}
                                  </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 border-t md:border-t-0 pt-4 md:pt-0">
                        <div className="flex-1 md:flex-none">
                            <select
                                className={`w-full md:w-auto px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest outline-none cursor-pointer border transition-all ${
                                    apt.status === 'completed' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 
                                    apt.status === 'confirmed' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' :
                                    apt.status === 'cancelled' ? 'bg-rose-50 border-rose-200 text-rose-700' :
                                    'bg-amber-50 border-amber-200 text-amber-700'
                                }`}
                                value={apt.status}
                                onChange={(e) => handleStatusUpdate(apt.id, e.target.value as any)}
                            >
                                <option value="pending">Pending</option>
                                <option value="confirmed">Confirmed</option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            {apt.status !== 'completed' && (
                                <button 
                                    onClick={() => handleStatusUpdate(apt.id, 'completed')}
                                    className="p-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100"
                                    title="Mark as Complete"
                                >
                                    <CheckCircle className="w-5 h-5" />
                                </button>
                            )}
                            <button onClick={() => handleOpenEdit(apt)} className="p-3 bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                                <Edit2 className="w-5 h-5" />
                            </button>
                            <button onClick={() => handleDelete(apt.id)} className="p-3 bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      <AnimatePresence>
        {isModalOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white rounded-[40px] w-full max-w-xl overflow-hidden shadow-2xl"
            >
                <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h3 className="text-2xl font-bold text-slate-900">{editingBooking ? 'Edit Appointment' : 'New Appointment'}</h3>
                        <p className="text-sm text-slate-400 font-medium">Quickly schedule a client visit</p>
                    </div>
                    <button onClick={handleCloseModal} className="w-12 h-12 flex items-center justify-center bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors">
                        <X className="w-6 h-6 text-slate-400" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-10 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Customer Name</label>
                            <input required type="text" className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                            <input required type="tel" className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Service Type</label>
                        <select className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold appearance-none cursor-pointer" value={formData.service} onChange={e => setFormData({ ...formData, service: e.target.value })}>
                            <option>Haircut</option>
                            <option>Beard Grooming</option>
                            <option>Premium Facial</option>
                            <option>Hair Coloring</option>
                            <option>VIP Combo</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Date</label>
                            <input required type="date" className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Time</label>
                            <input required type="time" className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold" value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Assign Barber (Optional)</label>
                        <select className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold appearance-none cursor-pointer" value={formData.staffId} onChange={e => setFormData({ ...formData, staffId: e.target.value })}>
                            <option value="">No preference</option>
                            {staff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
                        </select>
                    </div>

                    <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold text-lg mt-4 hover:bg-slate-900 transition-all shadow-xl shadow-indigo-100 active:scale-95 flex items-center justify-center gap-3">
                        {editingBooking ? 'Apply Changes' : 'Confirm Appointment'}
                        <ArrowRight className="w-5 h-5" />
                    </button>
                </form>
            </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  );
}
