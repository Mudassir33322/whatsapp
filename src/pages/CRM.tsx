import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  MoreHorizontal,
  UserPlus,
  Tag as TagIcon,
  Phone,
  MessageSquare,
  Clock,
  ChevronRight,
  Download,
  X,
  Loader2,
  Users
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { SendMessageModal } from '../components/SendMessageModal';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { motion } from 'motion/react';
import { API_URL } from '../config';

interface Customer {
  phone: string;
  name: string;
  global_points: number;
  referral_code?: string;
  tags?: string[];
  lastSeen: any;
  lastMessage?: string;
  status: string;
}

export function CRM() {
  const { user } = useAuth();
  const sessionId = user?.uid || '';
  const { sendMessage } = useSocket(sessionId);
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Form state
  const [formData, setFormData] = useState({ name: '', phone: '', tags: '' });

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await fetch(`${API_URL}/api/customers`);
        const data = await res.json();
        setCustomers(data);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch customers:', err);
        setLoading(false);
      }
    };

    fetchCustomers();
    const interval = setInterval(fetchCustomers, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({ name: customer.name, phone: customer.phone, tags: customer.tags?.join(', ') || '' });
    setIsModalOpen(true);
  };

  const handleOpenMessage = (phone: string) => {
    setSendingTo(phone);
  };

  const handleSendMessage = (to: string, message: string) => {
    sendMessage(sessionId, to, message);
    setSendingTo(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCustomer(null);
    setFormData({ name: '', phone: '', tags: '' });
  };

  const handleDelete = async (phone: string) => {
    if (!confirm('Delete this customer permanently?')) return;
    try {
      await fetch(`${API_URL}/api/customers/${encodeURIComponent(phone)}`, { method: 'DELETE' });
      setCustomers(prev => prev.filter(c => c.phone !== phone));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;
    try {
      const body = {
        name: formData.name,
        phone: formData.phone,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
        status: editingCustomer?.status || 'New'
      };
      await fetch(`${API_URL}/api/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      // Refresh list
      const res = await fetch(`${API_URL}/api/customers`);
      setCustomers(await res.json());
      handleCloseModal();
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  const filteredCustomers = customers.filter(c =>
    (c.name?.toLowerCase() || '').includes((searchTerm || '').toLowerCase()) ||
    c.phone.includes(searchTerm || '') ||
    c.tags?.some(t => t?.toLowerCase().includes((searchTerm || '').toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {sendingTo !== null && (
        <SendMessageModal
          initialPhone={sendingTo}
          onClose={() => setSendingTo(null)}
          onSend={handleSendMessage}
        />
      )}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">CRM Automation</h2>
          <p className="text-slate-500 text-sm">Unified customer data with smart segmentation and behavior tracking.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium">
            <Download className="w-4 h-4" />
            Export Data
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 text-sm font-semibold"
          >
            <UserPlus className="w-4 h-4" />
            Add Customer
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/50">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, phone or tag..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 border border-slate-200 rounded-lg bg-white hover:bg-slate-50">
              <Filter className="w-4 h-4 text-slate-600" />
            </button>
            <div className="h-4 w-px bg-slate-200 mx-2" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Sort by:</span>
            <select className="bg-transparent text-sm font-bold text-slate-700 outline-none">
              <option>Last Active</option>
              <option>Newest</option>
              <option>Lead Score</option>
            </select>
          </div>
        </div>

        {/* Table/List */}
        <div className="overflow-x-auto min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <p className="text-sm">Syncing with cloud...</p>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Users className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-sm font-medium">No customers found</p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-4 text-indigo-600 text-xs font-bold hover:underline"
              >
                Create your first CRM entry
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white">
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">Customer</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">Points & Referral</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">Latest Activity</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((c) => (
                  <tr key={c.phone} className="group hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 cursor-pointer">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold overflow-hidden">
                          <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${c.name}`} alt="avatar" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{c.name}</p>
                          <p className="text-xs text-slate-400 font-medium flex items-center gap-1">
                            <Phone className="w-2.5 h-2.5" />
                            {c.phone}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-sm">
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center gap-1.5 font-bold text-indigo-600">
                           ⭐ {c.global_points} Points
                        </span>
                        {c.referral_code && (
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                             Code: {c.referral_code}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-sm">
                      <div className="flex items-start gap-2">
                        <div className="mt-1 p-1 bg-blue-50 text-blue-500 rounded-md">
                          <MessageSquare className="w-3 h-3" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-600 italic line-clamp-1">"{c.lastMessage || 'No messages yet'}"</p>
                          <p className="text-[10px] text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {c.lastSeen ? formatDistanceToNow(parseISO(c.lastSeen), { addSuffix: true }) : 'no activity'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpenMessage(c.phone); }}
                          className="p-2 text-indigo-400 hover:text-indigo-600 transition-colors bg-indigo-50/50 rounded-lg"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpenEdit(c); }}
                          className="p-2 text-slate-300 hover:text-slate-600 transition-colors"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(c.phone); }}
                          className="p-2 text-slate-300 hover:text-rose-600 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-400">
          <p>Showing {filteredCustomers.length} of {customers.length} tracked leads</p>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 border border-slate-200 rounded-md hover:bg-slate-50">Prev</button>
            <button className="px-3 py-1 bg-indigo-600 text-white rounded-md">1</button>
            <button className="px-3 py-1 border border-slate-200 rounded-md hover:bg-slate-50">Next</button>
          </div>
        </div>
      </div>

      {/* Add Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
          >
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold">{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</h3>
              <button onClick={handleCloseModal} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Customer Name</label>
                <input
                  autoFocus
                  required
                  type="text"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                  placeholder="e.g. John Doe"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">WhatsApp Phone</label>
                <input
                  required
                  type="tel"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                  placeholder="e.g. +1234567890"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Tags (comma separated)</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                  placeholder="e.g. VIP, Real Estate"
                  value={formData.tags}
                  onChange={e => setFormData({ ...formData, tags: e.target.value })}
                />
              </div>
              <button
                type="submit"
                className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold mt-4 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
              >
                {editingCustomer ? 'Update Profile' : 'Register Customer'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

