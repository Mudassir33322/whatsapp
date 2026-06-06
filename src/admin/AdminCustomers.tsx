import { useState, useEffect } from 'react';
import { Search, User, Store, Phone, Calendar, Loader2, MessageSquare, ArrowLeft, Send } from 'lucide-react';
import { format } from 'date-fns';

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
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [chatView, setChatView] = useState<{ phone: string; name: string } | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatText, setChatText] = useState('');
  const [sending, setSending] = useState(false);

  const hd = () => ({ Authorization: `Bearer ${localStorage.getItem('admin-token')}`, 'Content-Type': 'application/json' });

  const fetchAll = async (q?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('search', q);
      const res = await fetch(`/api/admin/customers?${params}`, { headers: hd() });
      if (res.ok) setCustomers(await res.json());
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => { const t = setTimeout(() => fetchAll(search), 300); return () => clearTimeout(t); }, [search]);

  const openChat = async (phone: string, name: string) => {
    setChatView({ phone, name });
    setChatLoading(true);
    setChatMessages([]);
    try {
      const res = await fetch(`/api/admin/chats/${encodeURIComponent(phone)}/messages`, { headers: hd() });
      if (res.ok) setChatMessages(await res.json());
    } catch {} finally { setChatLoading(false); }
  };

  const sendMessage = async () => {
    if (!chatText.trim() || !chatView || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/chats/${encodeURIComponent(chatView.phone)}/messages`, {
        method: 'POST',
        headers: { ...hd(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: chatText, fromMe: true })
      });
      if (res.ok) {
        setChatMessages(prev => [...prev, {
          id: Date.now(),
          phone: chatView.phone,
          pushName: 'Admin',
          text: chatText,
          fromMe: true,
          timestamp: new Date().toISOString()
        }]);
        setChatText('');
      }
    } catch {} finally { setSending(false); }
  };

  // Chat View
  if (chatView) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setChatView(null)} className="p-2 hover:bg-slate-700 rounded-xl transition-colors">
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
            <p className="text-center text-slate-500 py-8 text-sm">No messages yet</p>
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
          <button onClick={sendMessage} disabled={!chatText.trim() || sending}
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
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers..." className="pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 w-64" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>
      ) : (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Salon</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Visits</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Points</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Last Visit</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500 text-sm">No customers found</td></tr>
              ) : customers.map((c: any, i: number) => {
                const sc = CUSTOMER_STATUS[c.status ?? 0] || CUSTOMER_STATUS[0];
                return (
                <tr key={`${c.customer_phone}-${i}`} className="border-b border-slate-700/50 hover:bg-slate-700/30">
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
                    <button onClick={() => openChat(c.customer_phone, c.customer_name)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg hover:bg-indigo-500/20 transition-colors text-xs font-medium">
                      <MessageSquare className="w-3.5 h-3.5" /> Chat
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
