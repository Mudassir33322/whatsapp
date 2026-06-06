import { useState, useEffect, Fragment } from 'react';
import { UserCircle, Search, Phone, Calendar, ChevronDown, ChevronUp, Loader2, MessageSquare, Send, ArrowLeft } from 'lucide-react';
import { authHeaders } from './api';

interface Customer {
  phone: string;
  name: string;
  total_visits: number;
  loyalty_points: number;
  last_visit: string;
  status?: number;
  last_active?: string;
}

interface Appointment {
  id: number;
  start_time: string;
  service_name?: string;
  barber_name?: string;
  status: string;
}

interface CustomerDetail extends Customer {
  appointments: Appointment[];
}

interface ChatMessage {
  id: number;
  phone: string;
  pushName: string;
  text: string;
  fromMe: boolean;
  timestamp: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  no_show: 'bg-gray-100 text-gray-600',
};

const CUSTOMER_STATUS = {
  0: { label: 'New', color: 'bg-yellow-100 text-yellow-700' },
  1: { label: 'Active', color: 'bg-emerald-100 text-emerald-700' },
  2: { label: 'Inactive', color: 'bg-red-100 text-red-700' },
};

const fmtStatus = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function SalonCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [expandedPhone, setExpandedPhone] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [chatView, setChatView] = useState<{ phone: string; name: string } | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatText, setChatText] = useState('');
  const [sending, setSending] = useState(false);

  const fetchCustomers = async (term: string) => {
    setLoading(true);
    setError('');
    try {
      const params = term ? `?search=${encodeURIComponent(term)}` : '';
      const r = await fetch(`/api/salon/customers${params}`, { headers: authHeaders() });
      if (!r.ok) throw new Error('Failed to fetch customers');
      setCustomers(await r.json());
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchCustomers(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const toggleExpand = async (phone: string) => {
    if (expandedPhone === phone) {
      setExpandedPhone(null);
      setDetail(null);
      return;
    }
    setExpandedPhone(phone);
    setDetailLoading(true);
    setDetail(null);
    try {
      const r = await fetch(`/api/salon/customers/${phone}`, { headers: authHeaders() });
      if (!r.ok) throw new Error('Failed to load customer details');
      setDetail(await r.json());
    } catch (e: any) { setError(e.message); }
    finally { setDetailLoading(false); }
  };

  const openChat = async (phone: string, name: string) => {
    setChatView({ phone, name });
    setChatLoading(true);
    setChatMessages([]);
    try {
      const r = await fetch(`/api/salon/chats/${encodeURIComponent(phone)}/messages`, { headers: authHeaders() });
      if (r.ok) setChatMessages(await r.json());
    } catch {} finally { setChatLoading(false); }
  };

  const sendMessage = async () => {
    if (!chatText.trim() || !chatView || sending) return;
    setSending(true);
    try {
      const r = await fetch(`/api/salon/chats/${encodeURIComponent(chatView.phone)}/send`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: chatText })
      });
      if (r.ok) {
        setChatMessages(prev => [...prev, {
          id: Date.now(),
          phone: chatView.phone,
          pushName: 'You',
          text: chatText,
          fromMe: true,
          timestamp: new Date().toISOString()
        }]);
        setChatText('');
      }
    } catch {} finally { setSending(false); }
  };

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  if (loading && !customers.length) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  if (error && !customers.length) return <div className="flex items-center justify-center min-h-[60vh]"><div className="bg-red-50 text-red-700 px-6 py-4 rounded-xl border border-red-200 text-sm font-medium">{error}</div></div>;

  // Chat View
  if (chatView) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setChatView(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{chatView.name || chatView.phone}</h2>
            <p className="text-xs text-gray-500">{chatView.phone}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 min-h-[50vh] max-h-[60vh] overflow-y-auto p-4 space-y-3">
          {chatLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
          ) : chatMessages.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">No messages yet</p>
          ) : (
            chatMessages.map((m, i) => (
              <div key={m.id || i} className={`flex ${m.fromMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] p-3 rounded-2xl text-sm ${
                  m.fromMe ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                }`}>
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  <p className={`text-[10px] mt-1 ${m.fromMe ? 'text-indigo-200' : 'text-gray-400'}`}>
                    {m.timestamp ? new Date(m.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
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
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
          <button onClick={sendMessage} disabled={!chatText.trim() || sending}
            className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone..."
          className="w-full max-w-xs pl-9 pr-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
      </div>
      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl border border-red-200 text-sm">{error}</div>}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3">Phone</th>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Total Visits</th>
                <th className="px-6 py-3">Loyalty Points</th>
                <th className="px-6 py-3">Last Visit</th>
                <th className="px-6 py-3 w-24">Chat</th>
                <th className="px-6 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!customers.length ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-gray-400">No customers found</td></tr>
              ) : customers.map((c) => (
                <Fragment key={c.phone}>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0"><Phone className="w-4 h-4" /></div>
                        <span className="font-medium text-gray-900">{c.phone}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0"><UserCircle className="w-4 h-4" /></div>
                        <span className="font-medium text-gray-900">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${CUSTOMER_STATUS[c.status as keyof typeof CUSTOMER_STATUS]?.color || 'bg-gray-100 text-gray-600'}`}>
                        {CUSTOMER_STATUS[c.status as keyof typeof CUSTOMER_STATUS]?.label || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-gray-900 font-medium">{c.total_visits}</td>
                    <td className="px-6 py-3.5">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">{c.loyalty_points}</span>
                    </td>
                    <td className="px-6 py-3.5 text-gray-700 whitespace-nowrap">{fmtDate(c.last_visit)}</td>
                    <td className="px-6 py-3.5">
                      <button onClick={() => openChat(c.phone, c.name)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-xs font-medium">
                        <MessageSquare className="w-3.5 h-3.5" /> Chat
                      </button>
                    </td>
                    <td className="px-6 py-3.5">
                      <button onClick={() => toggleExpand(c.phone)} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                        {expandedPhone === c.phone ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      </button>
                    </td>
                  </tr>
                  {expandedPhone === c.phone && (
                    <tr>
                      <td colSpan={8} className="px-6 py-4 bg-gray-50">
                        {detailLoading ? (
                          <div className="flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-indigo-600" /></div>
                        ) : detail ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                              <div className="bg-white rounded-xl p-3 border border-gray-200">
                                <p className="text-xs text-gray-500">Total Visits</p>
                                <p className="text-lg font-bold text-gray-900">{detail.total_visits}</p>
                              </div>
                              <div className="bg-white rounded-xl p-3 border border-gray-200">
                                <p className="text-xs text-gray-500">Loyalty Points</p>
                                <p className="text-lg font-bold text-amber-600">{detail.loyalty_points}</p>
                              </div>
                              <div className="bg-white rounded-xl p-3 border border-gray-200">
                                <p className="text-xs text-gray-500">Last Visit</p>
                                <p className="text-lg font-bold text-gray-900">{fmtDate(detail.last_visit)}</p>
                              </div>
                            </div>
                            {detail.appointments && detail.appointments.length > 0 ? (
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-2">Recent Appointments</h4>
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-gray-100 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                      <th className="px-4 py-2">Date</th>
                                      <th className="px-4 py-2">Service</th>
                                      <th className="px-4 py-2">Barber</th>
                                      <th className="px-4 py-2">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200">
                                    {detail.appointments.map((a) => (
                                      <tr key={a.id} className="bg-white">
                                        <td className="px-4 py-2.5 text-gray-900 whitespace-nowrap">
                                          <div className="flex items-center gap-2">
                                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                            {new Date(a.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                          </div>
                                        </td>
                                        <td className="px-4 py-2.5 text-gray-700">{a.service_name || '—'}</td>
                                        <td className="px-4 py-2.5 text-gray-700">{a.barber_name || '—'}</td>
                                        <td className="px-4 py-2.5">
                                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[a.status] || 'bg-gray-100 text-gray-600'}`}>
                                            {fmtStatus(a.status)}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-400 text-center py-2">No appointment history</p>
                            )}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
