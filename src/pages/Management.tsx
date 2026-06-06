import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Armchair, 
  Clock, 
  Wallet, 
  Plus, 
  Trash2, 
  Edit3, 
  X, 
  CheckCircle2, 
  Loader2,
  Calendar,
  Save,
  UserPlus,
  DollarSign,
  Briefcase,
  MapPin,
  Globe,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { API_URL } from '../config';

interface Staff {
  id: string;
  name: string;
  phone: string;
  role: string;
  salary: number;
  salaryType: 'fixed' | 'commission';
  commissionRate?: number;
}

interface Seat {
  id: string;
  name: string;
  status: 'Available' | 'Occupied';
  assignedStaffId?: string;
}

interface WorkingHours {
  day: string;
  start: string;
  end: string;
  isOpen: boolean;
}

interface SalaryPayment {
  id: string;
  staffId: string;
  staffName: string;
  amount: number;
  date: string;
  type: 'Salary' | 'Commission' | 'Bonus' | 'Advance';
  status: 'Paid' | 'Pending';
}

export function Management() {
  const [activeTab, setActiveTab] = useState<'salons' | 'staff' | 'seats' | 'hours' | 'salaries' | 'location' | 'settings'>('salons');
  const [salons, setSalons] = useState<any[]>([]);
  const [selectedSalonId, setSelectedSalonId] = useState<string>('');
  const [staff, setStaff] = useState<Staff[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [hours, setHours] = useState<WorkingHours[]>([]);
  const [salaries, setSalaries] = useState<SalaryPayment[]>([]);
  const [location, setLocation] = useState({ address: '', mapUrl: '' });
  const [settings, setSettings] = useState({ companyName: '', currency: 'Rs.', language: 'Urdu/English' });
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'staff' | 'seat' | 'salary'>('staff');
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    phone: '',
    role: 'Barber',
    salary: '20000',
    salaryType: 'fixed' as 'fixed' | 'commission',
    commissionRate: '10',
    staffId: '',
    amount: '',
    type: 'Salary' as any,
    status: 'Available' as any
  });

  const fetchData = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const [salRes, staffRes, seatsRes, hoursRes, salResFin, locRes, setRes] = await Promise.all([
        fetch(`${API_URL}/api/salons`, { signal }),
        fetch(`${API_URL}/api/staff?salonId=${selectedSalonId}`, { signal }),
        fetch(`${API_URL}/api/seats?salonId=${selectedSalonId}`, { signal }),
        fetch(`${API_URL}/api/settings/working-hours?salonId=${selectedSalonId}`, { signal }),
        fetch(`${API_URL}/api/salaries?salonId=${selectedSalonId}`, { signal }),
        fetch(`${API_URL}/api/location?salonId=${selectedSalonId}`, { signal }),
        fetch(`${API_URL}/api/settings?salonId=${selectedSalonId}`, { signal })
      ]);
      
      const [salonsData, staffData, seatsData, hoursData, salData, locData, setData] = await Promise.all([
        salRes.json(), staffRes.json(), seatsRes.json(), hoursRes.json(), salResFin.json(), locRes.json(), setRes.json()
      ]);

      setSalons(salonsData);
      setStaff(staffData);
      setSeats(seatsData);
      setHours(hoursData);
      setSalaries(salData);
      setLocation(locData);
      setSettings(setData);
      setLoading(false);
    } catch (err) { console.error(err); setLoading(false); }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEditing = !!formData.id;
    const endpoint = modalType === 'staff' 
      ? (isEditing ? `${API_URL}/api/staff/${formData.id}` : `${API_URL}/api/staff`)
      : modalType === 'seat'
      ? (isEditing ? `${API_URL}/api/seats/${formData.id}` : `${API_URL}/api/seats`)
      : `${API_URL}/api/salaries`;
      
    const body = modalType === 'staff' 
      ? { name: formData.name, phone: formData.phone, role: formData.role, salary: Number(formData.salary), salaryType: formData.salaryType, commissionRate: Number(formData.commissionRate) }
      : modalType === 'seat'
      ? { name: formData.name, status: formData.status }
      : { staffId: formData.staffId, staffName: staff.find(s => s.id === formData.staffId)?.name || 'Unknown', amount: Number(formData.amount), type: formData.type, status: 'Paid' };

    try {
      await fetch(endpoint, {
        method: isEditing && modalType !== 'salary' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      setIsModalOpen(false);
      setFormData({
        id: '', name: '', phone: '', role: 'Barber', salary: '20000', salaryType: 'fixed', commissionRate: '10', staffId: '', amount: '', type: 'Salary', status: 'Active'
      });
      fetchData();
    } catch (err) {
      console.error('Save failed', err);
    }
  };

  const handleEdit = (type: 'staff' | 'seat', data: any) => {
    setModalType(type);
    if (type === 'staff') {
      setFormData({
        ...formData,
        id: data.id,
        name: data.name,
        phone: data.phone,
        role: data.role,
        salary: String(data.salary),
        salaryType: data.salaryType,
        commissionRate: String(data.commissionRate || '10')
      });
    } else {
      setFormData({
        ...formData,
        id: data.id,
        name: data.name,
        status: data.status
      });
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (type: string, id: string) => {
    if (!confirm(`Delete this ${type}?`)) return;
    try {
      await fetch(`${API_URL}/api/${type}/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const handleUpdateHours = async () => {
    try {
      await fetch(`${API_URL}/api/settings/working-hours`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hours)
      });
      alert('Working hours updated successfully!');
    } catch (err) {
      console.error('Update hours failed', err);
    }
  };

  const handleUpdateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch(`${API_URL}/api/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(location)
      });
      alert('Location updated successfully!');
    } catch (err) {
      console.error('Update location failed', err);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch(`${API_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      alert('General settings updated!');
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Shop Management</h2>
          <p className="text-slate-500 mt-1">Manage your team, seats, and operations.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => { setModalType('staff'); setIsModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-bold shadow-lg shadow-indigo-100"
          >
            <UserPlus className="w-4 h-4" />
            Add Staff
          </button>
          <button 
            onClick={() => { setModalType('seat'); setIsModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-all font-bold shadow-sm"
          >
            <Armchair className="w-4 h-4" />
            Add Seat
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-50 px-4 overflow-x-auto no-scrollbar">
          {[
            { id: 'staff', label: 'Staff & Barbers', icon: Users },
            { id: 'seats', label: 'Seat Management', icon: Armchair },
            { id: 'hours', label: 'Working Hours', icon: Clock },
            { id: 'salaries', label: 'Salary Tracker', icon: Wallet },
            { id: 'location', label: 'Shop Location', icon: MapPin },
            { id: 'settings', label: 'General Settings', icon: Settings }
          ].map((tab) => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-8 py-6 text-sm font-black uppercase tracking-widest transition-all relative whitespace-nowrap flex items-center gap-2 ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {activeTab === tab.id && <motion.div layoutId="tab-active-mgmt" className="absolute bottom-0 left-8 right-8 h-1 bg-indigo-600 rounded-t-full" />}
            </button>
          ))}
        </div>

        <div className="p-10">
          <AnimatePresence mode="wait">
            {activeTab === 'staff' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} key="staff" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {staff.map(s => (
                  <div key={s.id} className="p-8 bg-slate-50 border border-slate-100 rounded-[32px] relative group hover:border-indigo-200 transition-all">
                    <div className="absolute top-6 right-6 flex gap-2">
                      <button onClick={() => handleEdit('staff', s)} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors">
                        <Edit3 className="w-5 h-5" />
                      </button>
                      <button onClick={() => handleDelete('staff', s.id)} className="p-2 text-slate-300 hover:text-rose-600 transition-colors">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-6">
                      <Users className="w-8 h-8 text-indigo-600" />
                    </div>
                    <h4 className="text-xl font-bold text-slate-900">{s.name}</h4>
                    <p className="text-sm font-bold text-indigo-600 uppercase tracking-widest mt-1">{s.role}</p>
                    <div className="mt-6 pt-6 border-t border-slate-200/50 space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400 font-bold uppercase tracking-tighter">Salary</span>
                        <span className="font-black text-slate-900">Rs. {s.salary.toLocaleString()} ({s.salaryType})</span>
                      </div>
                      {s.salaryType === 'commission' && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400 font-bold uppercase tracking-tighter">Comm. Rate</span>
                          <span className="font-black text-emerald-600">{s.commissionRate}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {staff.length === 0 && (
                  <div className="col-span-full py-20 text-center bg-slate-50 border-2 border-dashed border-slate-100 rounded-[40px] text-slate-400">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p className="font-bold text-lg text-slate-600">No staff members yet</p>
                    <p className="text-sm">Click "Add Staff" to build your team.</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'seats' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} key="seats" className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {seats.map(seat => (
                  <div key={seat.id} className={`p-6 border-2 rounded-[32px] text-center transition-all ${seat.status === 'Available' ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                    <Armchair className={`w-10 h-10 mx-auto mb-4 ${seat.status === 'Available' ? 'text-emerald-500' : 'text-rose-500'}`} />
                    <h4 className="font-bold text-slate-900">{seat.name}</h4>
                    <p className={`text-[10px] font-black uppercase tracking-widest mt-2 ${seat.status === 'Available' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {seat.status}
                    </p>
                    <div className="mt-4 flex justify-center gap-2">
                      <button onClick={() => handleEdit('seat', seat)} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete('seats', seat.id)} className="p-2 text-slate-300 hover:text-rose-600 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {activeTab === 'hours' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} key="hours" className="space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  {hours.map((h, i) => (
                    <div key={h.day} className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-slate-50 border border-slate-100 rounded-3xl gap-4">
                      <div className="flex items-center gap-4 w-40">
                        <div className={`w-3 h-3 rounded-full ${h.isOpen ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        <span className="font-bold text-slate-900">{h.day}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <input 
                            type="time" 
                            value={h.start} 
                            disabled={!h.isOpen}
                            onChange={e => {
                              const newHours = [...hours];
                              newHours[i].start = e.target.value;
                              setHours(newHours);
                            }}
                            className="px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50" 
                          />
                          <span className="text-slate-400 font-bold">to</span>
                          <input 
                            type="time" 
                            value={h.end} 
                            disabled={!h.isOpen}
                            onChange={e => {
                              const newHours = [...hours];
                              newHours[i].end = e.target.value;
                              setHours(newHours);
                            }}
                            className="px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50" 
                          />
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={h.isOpen} 
                            onChange={e => {
                              const newHours = [...hours];
                              newHours[i].isOpen = e.target.checked;
                              setHours(newHours);
                            }}
                            className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                          />
                          <span className="text-sm font-bold text-slate-600">{h.isOpen ? 'Open' : 'Closed'}</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end pt-6">
                  <button onClick={handleUpdateHours} className="flex items-center gap-2 px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-black transition-all shadow-xl active:scale-95">
                    <Save className="w-5 h-5" />
                    Save Operational Hours
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === 'salaries' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} key="salaries" className="space-y-8">
                <div className="flex justify-end">
                  <button 
                    onClick={() => { setModalType('salary'); setIsModalOpen(true); }}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-bold shadow-lg"
                  >
                    <DollarSign className="w-4 h-4" />
                    Record Payment
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left border-b border-slate-50">
                        <th className="pb-6 text-xs font-black text-slate-400 uppercase tracking-widest">Date</th>
                        <th className="pb-6 text-xs font-black text-slate-400 uppercase tracking-widest">Staff Name</th>
                        <th className="pb-6 text-xs font-black text-slate-400 uppercase tracking-widest">Payment Type</th>
                        <th className="pb-6 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                        <th className="pb-6 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {salaries.map(sal => (
                        <tr key={sal.id} className="group hover:bg-slate-50/50 transition-colors">
                          <td className="py-6 text-sm font-bold text-slate-500">{new Date(sal.date).toLocaleDateString()}</td>
                          <td className="py-6 text-sm font-bold text-slate-900">{sal.staffName}</td>
                          <td className="py-6">
                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase ${
                              sal.type === 'Salary' ? 'bg-indigo-50 text-indigo-600' : 
                              sal.type === 'Commission' ? 'bg-emerald-50 text-emerald-600' : 
                              'bg-amber-50 text-amber-600'
                            }`}>{sal.type}</span>
                          </td>
                          <td className="py-6 text-sm font-black text-slate-900 text-right">Rs. {sal.amount.toLocaleString()}</td>
                          <td className="py-6 text-right">
                             <button onClick={() => handleDelete('salaries', sal.id)} className="p-2 text-slate-300 hover:text-rose-600 transition-colors">
                                <Trash2 className="w-4 h-4" />
                             </button>
                          </td>
                        </tr>
                      ))}
                      {salaries.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-20 text-center text-slate-400">No salary records found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'location' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} key="location" className="max-w-2xl">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Shop Location & Map</h3>
                    <p className="text-sm text-slate-500">Set your shop's address and Google Maps link for customers.</p>
                  </div>
                </div>

                <form onSubmit={handleUpdateLocation} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Physical Address</label>
                    <textarea 
                      value={location.address}
                      onChange={e => setLocation({...location, address: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold resize-none h-32"
                      placeholder="e.g. Shop #4, Main Market, Block-B, City Name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Google Maps URL</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                        <Globe className="w-5 h-5 text-slate-400" />
                      </div>
                      <input 
                        type="url"
                        value={location.mapUrl}
                        onChange={e => setLocation({...location, mapUrl: e.target.value})}
                        className="w-full pl-14 pr-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold"
                        placeholder="https://goo.gl/maps/..."
                      />
                    </div>
                  </div>
                  <button type="submit" className="flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-slate-900 transition-all shadow-xl active:scale-95">
                    <Save className="w-5 h-5" />
                    Save Location Details
                  </button>
                </form>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} key="settings" className="max-w-2xl">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                    <Settings className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">General Settings</h3>
                    <p className="text-sm text-slate-500">Manage your company branding and system preferences.</p>
                  </div>
                </div>

                <form onSubmit={handleUpdateSettings} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Company / Shop Name</label>
                    <input 
                      type="text" 
                      value={settings.companyName}
                      onChange={e => setSettings({...settings, companyName: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold"
                      placeholder="e.g. AutoZap Salon"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Currency Symbol</label>
                      <input 
                        type="text" 
                        value={settings.currency}
                        onChange={e => setSettings({...settings, currency: e.target.value})}
                        className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">System Language</label>
                      <select 
                        value={settings.language}
                        onChange={e => setSettings({...settings, language: e.target.value})}
                        className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold"
                      >
                        <option>Urdu/English</option>
                        <option>English Only</option>
                        <option>Urdu Only</option>
                      </select>
                    </div>
                  </div>
                  <button type="submit" className="flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-slate-900 transition-all shadow-xl active:scale-95">
                    <Save className="w-5 h-5" />
                    Save General Settings
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="bg-white rounded-[40px] w-full max-w-xl overflow-hidden shadow-2xl">
              <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-2xl font-bold text-slate-900">
                  {modalType === 'staff' ? (formData.id ? 'Edit Staff Member' : 'Add New Staff') : modalType === 'seat' ? (formData.id ? 'Edit Shop Seat' : 'Add Shop Seat') : 'Record Staff Payment'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 flex items-center justify-center bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-rose-600 transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-10 space-y-6">
                {modalType === 'staff' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                      <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold" />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Role</label>
                        <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold appearance-none">
                          <option>Barber</option>
                          <option>Stylist</option>
                          <option>Receptionist</option>
                          <option>Manager</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Phone</label>
                        <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Salary Model</label>
                        <select value={formData.salaryType} onChange={e => setFormData({...formData, salaryType: e.target.value as any})} className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold appearance-none">
                          <option value="fixed">Fixed Monthly</option>
                          <option value="commission">Commission Based</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                          {formData.salaryType === 'fixed' ? 'Base Salary (Rs)' : 'Commission Rate (%)'}
                        </label>
                        <input required type="number" value={formData.salaryType === 'fixed' ? formData.salary : formData.commissionRate} onChange={e => setFormData({...formData, [formData.salaryType === 'fixed' ? 'salary' : 'commissionRate']: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold" />
                      </div>
                    </div>
                  </>
                )}

                {modalType === 'seat' && (
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Seat Name / Number</label>
                    <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold" placeholder="e.g. Chair 5" />
                  </div>
                )}

                {modalType === 'salary' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Select Staff Member</label>
                      <select required value={formData.staffId} onChange={e => setFormData({...formData, staffId: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold appearance-none">
                        <option value="">Choose Staff...</option>
                        {staff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Amount Paid (Rs)</label>
                        <input required type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Payment Type</label>
                        <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})} className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold appearance-none">
                          <option>Salary</option>
                          <option>Commission</option>
                          <option>Bonus</option>
                          <option>Advance</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}

                <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold text-lg mt-4 hover:bg-slate-900 transition-all shadow-xl shadow-indigo-100 active:scale-95">
                  Save Changes
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
