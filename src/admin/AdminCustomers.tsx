import { useState, useEffect, useMemo } from 'react';
import { Search, User, Store, Loader2, MessageSquare, ArrowLeft, Send, Plus, Pencil, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';
import { useAdminAuth } from './AdminAuthContext';
import { EmptyState } from '../components/EmptyState';
import SalonLocationFilter from './SalonLocationFilter';
import { useConfirm } from '../hooks/useConfirm';
import { Pagination } from '../components/Pagination';

interface ChatMessage {
  id: number;
  phone: string;
  pushName: string;
  text: string;
  fromMe: boolean;
  timestamp: string;
}

const CUSTOMER_STATUS: Record<number, { label: string; color: string }> = {
  0: { label: 'New', color: 'bg-yellow-500/10 text-yellow-400' },
  1: { label: 'Active', color: 'bg-emerald-500/10 text-emerald-400' },
  2: { label: 'Inactive', color: 'bg-red-500/10 text-red-400' },
};

export function AdminCustomers() {
  const { adminFetch } = useAdminAuth();
  const { confirm, confirmDialog } = useConfirm();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [salons, setSalons] = useState<any[]>([]);
  const [salonFilter, setSalonFilter] = useState('');
  const [chatView, setChatView] = useState<{ phone: string; name: string } | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatText, setChatText] = useState('');
  const [sending, setSending] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ phone: '', name: '' });
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const toggleSelect = (phone: string) => setSelectedPhones((prev) => {
    const n = new Set(prev);
    if (n.has(phone)) n.delete(phone); else n.add(phone);
    return n;
  });
  const toggleSelectAll = () => setSelectedPhones((prev) => (prev.size === paginatedCustomers.length ? new Set() : new Set(paginatedCustomers.map((c: any) => c.customer_phone))));
  const clearSelection = () => setSelectedPhones(new Set());
  const bulkDelete = async () => {
    if (selectedPhones.size === 0) return;
    const confirmed = await confirm('Delete Selected', `Delete ${selectedPhones.size} customer(s)? This action cannot be undone.`, 'Delete');
    if (!confirmed) return;
    setBulkDeleting(true);
    try {
      await Promise.all([...selectedPhones].map((phone) => adminFetch(`/api/admin/customers/${encodeURIComponent(phone)}`, { method: 'DELETE' })));
      setSelectedPhones(new Set());
      await fetchAll(search);
    } catch (e: any) { console.error('[AdminCustomers] Bulk delete failed:', e); } finally { setBulkDeleting(false); }
  };

  const fetchAll = async (q?: string, sid?: string, signal?: AbortSignal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('search', q);
      if (sid) params.set('salon_id', sid);
      const res = await adminFetch(`/api/admin/customers?${params}`, { signal });
      if (res.ok) {
        const data = await res.json();
        setCustomers(Array.isArray(data) ? data : data.customers || []);
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (salonFilter) params.set('salon_id', salonFilter);
        const res = await adminFetch(`/api/admin/customers?${params}`, { signal: ac.signal });
        if (res.ok) {
          const data = await res.json();
          setCustomers(Array.isArray(data) ? data : data.customers || []);
        }
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
      } finally { setLoading(false); }
    })();
    return () => ac.abort();
  }, [salonFilter]);

  useEffect(() => {
    const ac = new AbortController();
    const t = setTimeout(() => { fetchAll(search, salonFilter, ac.signal); }, 300);
    return () => { clearTimeout(t); ac.abort(); };
  }, [search, salonFilter]);

  useEffect(() => { setPage(1); }, [search, salonFilter]);

  const paginatedCustomers = useMemo(() =>
    customers.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE),
    [customers, page]
  );

  const openChat = async (phone: string, name: string) => {
    setChatView({ phone, name });
    setChatLoading(true);
    setChatMessages([]);
    try {
      const res = await adminFetch(`/api/admin/chats/${encodeURIComponent(phone)}/messages`);
      if (res.ok) setChatMessages(await res.json());
    } catch (err) {
      console.error('[AdminCustomers] Failed to load chat:', err);
    } finally { setChatLoading(false); }
  };

  const sendMessage = async () => {
    if (!chatText.trim() || !chatView || sending) return;
    setSending(true);
    try {
      const res = await adminFetch(`/api/admin/chats/${encodeURIComponent(chatView.phone)}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: chatText.trim() }),
      });
      if (res.ok) {
        setChatMessages(prev => [...prev, { id: Date.now(), phone: chatView.phone, pushName: 'Admin', text: chatText.trim(), fromMe: true, timestamp: new Date().toISOString() }]);
        setChatText('');
      }
    } catch (err) {
      console.error('[AdminCustomers] Failed to send message:', err);
    } finally { setSending(false); }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ phone: '', name: '' });
    setShowModal(true);
  };

  const openEdit = (c: any) => {
    setEditing(c);
    setForm({ phone: c.customer_phone || '', name: c.customer_name || '' });
    setShowModal(true);
  };

  const saveCustomer = async () => {
    if (!form.phone || !form.name) return;
    try {
      const isEdit = !!editing;
      const url = isEdit ? `/api/admin/customers/${encodeURIComponent(form.phone)}` : '/api/admin/customers';
      const res = await adminFetch(url, {
        method: isEdit ? 'PUT' : 'POST', body: JSON.stringify({ phone: form.phone, name: form.name }),
      });
      if (!res.ok) throw new Error('Failed');
      setEditing(null);
      setShowModal(false);
      await fetchAll(search, salonFilter);
    } catch (e: any) { alert(e.message); }
  };

  const deleteCustomer = async (phone: string) => {
    const confirmed = await confirm('Delete Customer', `Are you sure you want to delete customer ${phone}? This action cannot be undone.`, 'Delete');
    if (!confirmed) return;
    try {
      const res = await adminFetch(`/api/admin/customers/${encodeURIComponent(phone)}`, { method: 'DELETE' });
      if (res.ok) setCustomers(prev => prev.filter((c: any) => c.customer_phone !== phone));
    } catch (err) {
      console.error('[AdminCustomers] Failed to delete customer:', err);
    }
  };

  if (chatView) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setChatView(null)} className="p-2 hover:bg-slate-700 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-300" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-white">{chatView.name || chatView.phone}</h2>
            <p className="text-xs text-slate-400">{chatView.phone}</p>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl border border-slate-700 min-h-[50vh] max-h-[60vh] overflow-y-auto p-4 space-y-3">
          {chatLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
          ) : chatMessages.length === 0 ? (
            <div className="px-4 py-8"><EmptyState icon={MessageSquare} title="No messages yet" description="Start a conversation with this customer" /></div>
          ) : (
            chatMessages.map((m, i) => (
              <div key={m.id || i} className={`flex ${m.fromMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] p-3 rounded-2xl text-sm ${
                  m.fromMe ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-slate-700 text-slate-200 rounded-bl-sm'
                }`}>
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  <p className={`text-[10px] mt-1 ${m.fromMe ? 'text-indigo-200' : 'text-slate-400'}`}>
                    {m.timestamp ? format(new Date(m.timestamp), 'HH:mm') : ''}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <input type="text" value={chatText} onChange={(e) => setChatText(e.target.value)}
            placeholder="Type a message..."
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <button type="button" onClick={sendMessage} disabled={!chatText.trim() || sending}
            className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 disabled:opacity-50 transition-colors">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Customers</h1>
          <p className="text-sm text-slate-400 mt-1">All customers across all salons</p>
        </div>
        <div className="flex gap-2">
          <SalonLocationFilter salonFilter={salonFilter} setSalonFilter={setSalonFilter} salons={salons} setSalons={setSalons} adminFetch={adminFetch} />
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers..." className="pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 w-64" />
          </div>
          <button type="button" onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all text-sm font-semibold">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden animate-pulse">
          <div className="p-4 border-b border-slate-700">
            <div className="h-4 bg-slate-700 rounded w-full" />
          </div>
          <div className="space-y-1 p-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-slate-700 rounded-full" />
                  <div className="h-4 bg-slate-700 rounded w-32" />
                </div>
                <div className="h-4 bg-slate-700 rounded w-24" />
                <div className="h-5 bg-slate-700 rounded w-14" />
                <div className="h-4 bg-slate-700 rounded w-10 text-center" />
                <div className="h-4 bg-slate-700 rounded w-12" />
                <div className="h-4 bg-slate-700 rounded w-20" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
        {selectedPhones.size > 0 && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-indigo-600/15 border border-indigo-500/30 rounded-xl">
            <span className="text-sm text-indigo-200 font-medium">{selectedPhones.size} selected</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={clearSelection} className="px-3 py-1.5 text-sm text-slate-300 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors">Clear</button>
              <button type="button" onClick={bulkDelete} disabled={bulkDeleting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                <Trash2 className="w-4 h-4" /> {bulkDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        )}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/50">
                <th className="text-left px-3 py-3 w-10">
                  <input type="checkbox" checked={paginatedCustomers.length > 0 && selectedPhones.size === paginatedCustomers.length} onChange={toggleSelectAll}
                    className="w-4 h-4 rounded cursor-pointer accent-indigo-500" />
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Salon</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Visits</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Points</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Last Visit</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase w-32">Actions</th>
              </tr>
            </thead>
<tbody>
               {customers.length === 0 ? (
                 <tr><td colSpan={8}><div className="px-6 py-8"><EmptyState icon={User} title="No customers found" description="Customers will appear here after their first appointment" /></div></td></tr>
               ) : paginatedCustomers.map((c: any, i: number) => {
                const sc = CUSTOMER_STATUS[c.status ?? 0] || CUSTOMER_STATUS[0];
                return (
                <tr key={`${c.customer_phone}-${i}`} className="border-b border-slate-700/50 hover:bg-slate-700/30 group">
                  <td className="px-3 py-3.5">
                    <input type="checkbox" checked={selectedPhones.has(c.customer_phone)} onChange={() => toggleSelect(c.customer_phone)} className="w-4 h-4 rounded cursor-pointer accent-indigo-500" />
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-slate-400" />
                      <span className="text-white">{c.customer_name || 'Unknown'}</span>
                      <span className="text-slate-500">{c.customer_phone}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3"><span className="flex items-center gap-1.5 text-sm text-slate-300"><Store className="w-3.5 h-3.5 text-slate-400" />{c.salon_name}</span></td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>{sc.label}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-slate-300">{c.total_visits}</td>
                  <td className="px-4 py-3 text-center text-sm text-amber-400 font-medium">{c.loyalty_points}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{c.last_visit ? format(new Date(c.last_visit), 'MMM d, yyyy') : '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button type="button" onClick={() => openChat(c.customer_phone, c.customer_name)}
                        className="p-1.5 text-indigo-400 hover:bg-indigo-500/10 rounded-lg"><MessageSquare className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => openEdit(c)}
                        className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => deleteCustomer(c.customer_phone)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          <div className="border-t border-slate-700">
            <Pagination page={page} totalPages={Math.ceil(customers.length / ITEMS_PER_PAGE)} onPageChange={setPage} />
          </div>
        </div>
      </>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowModal(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">{editing ? 'Edit Customer' : 'Add Customer'}</h2>
              <button type="button" onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-white rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Phone *</label>
                <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  disabled={!!editing}
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 placeholder-slate-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 border border-slate-600 text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-700 transition-all">Cancel</button>
              <button type="button" onClick={saveCustomer}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-all">
                {editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
