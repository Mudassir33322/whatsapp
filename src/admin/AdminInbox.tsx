import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Phone, Calendar, Loader2, User, Tag, Clock, MapPin, Send, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAdminAuth } from './AdminAuthContext';
import SalonLocationFilter from './SalonLocationFilter';
import { useConfirm } from '../hooks/useConfirm';

function fmtDate(value: string | undefined | null, fmt: string, fallback = ''): string {
  if (!value) return fallback;
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return fallback;
    return format(d, fmt);
  } catch (err) { console.error('[AdminInbox] fmtDate error:', err); return fallback; }
}

interface CustomerProfile {
  customer: {
    phone: string;
    name: string;
    global_points: number;
    loyalty_points: number;
    total_visits: number;
    created_at: string;
  };
  appointments: any[];
  tags: string[];
}

export function AdminInbox() {
  const { adminFetch } = useAdminAuth();
  const { confirm, confirmDialog } = useConfirm();
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [salons, setSalons] = useState<any[]>([]);
  const [salonFilter, setSalonFilter] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      setLoading(true);
      try {
        let url = '/api/admin/chats';
        if (salonFilter) url += `?salon_id=${salonFilter}`;
        const res = await adminFetch(url, { signal: ac.signal });
        if (res.ok) setContacts(await res.json());
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load chats');
      } finally { setLoading(false); }
    })();
    return () => ac.abort();
  }, [salonFilter]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async (phone: string) => {
    try {
      const res = await adminFetch(`/api/admin/chats/${phone}/messages`);
      if (res.ok) setMessages(await res.json());
    } catch (err: any) {
      if (err?.name !== 'AbortError') console.error('[AdminInbox] Failed to load messages:', err);
    }
  };

  const loadProfile = async (phone: string) => {
    setProfileLoading(true);
    setProfile(null);
    try {
      const res = await adminFetch(`/api/admin/customers/${encodeURIComponent(phone)}`);
      if (res.ok) setProfile(await res.json());
    } catch (err: any) {
      if (err?.name !== 'AbortError') console.error('[AdminInbox] Failed to load profile:', err);
    } finally { setProfileLoading(false); }
  };

  const isRealPhone = (phone: string) => phone && !phone.includes('@broadcast') && !phone.includes('@g.us') && !phone.includes('@newsletter') && !phone.includes('@lid');

  const selectContact = (c: any) => {
    setSelected(c);
    loadMessages(c.phone);
    if (isRealPhone(c.phone)) loadProfile(c.phone);
    setMsgText('');
  };

  const sendMessage = async () => {
    if (!selected || !msgText.trim() || sending) return;
    if (!isRealPhone(selected.phone)) return;
    setSending(true);
    try {
      const res = await adminFetch(`/api/admin/chats/${encodeURIComponent(selected.phone)}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: msgText.trim() })
      });
      if (res.ok) {
        setMessages(prev => [...prev, { text: msgText.trim(), fromMe: true, timestamp: new Date().toISOString() }]);
        setMsgText('');
        setContacts(prev => prev.map(c => c.phone === selected.phone ? { ...c, lastMessage: msgText.trim(), timestamp: new Date().toISOString() } : c));
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') console.error('[AdminInbox] Failed to send message:', err);
    } finally { setSending(false); }
  };

  const deleteConversation = async (phone: string) => {
    if (!isRealPhone(phone)) return;
    const confirmed = await confirm('Delete Conversation', 'Are you sure you want to delete all messages with this contact?', 'Delete', 'danger');
    if (!confirmed) return;
    try {
      const res = await adminFetch(`/api/admin/chats/${encodeURIComponent(phone)}/messages`, { method: 'DELETE' });
      if (res.ok) {
        setMessages([]);
        setContacts(prev => prev.map(c => c.phone === phone ? { ...c, lastMessage: undefined, timestamp: undefined } : c));
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') console.error('[AdminInbox] Failed to delete conversation:', err);
    }
  };

  const deleteMessage = async (msgId: number) => {
    if (!selected || !isRealPhone(selected.phone)) return;
    const confirmed = await confirm('Delete Message', 'Are you sure you want to delete this message?', 'Delete', 'danger');
    if (!confirmed) return;
    try {
      const res = await adminFetch(`/api/admin/chats/${encodeURIComponent(selected.phone)}/messages/${msgId}`, { method: 'DELETE' });
      if (res.ok) setMessages(prev => prev.filter(m => m.id !== msgId));
    } catch (err: any) {
      if (err?.name !== 'AbortError') console.error('[AdminInbox] Failed to delete message:', err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-700/50 rounded-lg w-36 mb-2" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-3 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden animate-pulse">
            <div className="space-y-1 p-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <div className="w-9 h-9 bg-slate-700 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-slate-700 rounded w-24" />
                    <div className="h-2 bg-slate-700/50 rounded w-32" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-5 bg-slate-800 rounded-xl border border-slate-700 min-h-[70vh] flex items-center justify-center animate-pulse">
            <div className="text-center">
              <div className="w-12 h-12 bg-slate-700 rounded-full mx-auto mb-3" />
              <div className="h-4 bg-slate-700 rounded w-40 mx-auto" />
            </div>
          </div>
          <div className="lg:col-span-4 bg-slate-800 rounded-xl border border-slate-700 p-4 animate-pulse">
            <div className="flex flex-col items-center space-y-3">
              <div className="w-16 h-16 bg-slate-700 rounded-full" />
              <div className="h-5 bg-slate-700 rounded w-28" />
              <div className="h-3 bg-slate-700 rounded w-36" />
              <div className="grid grid-cols-3 gap-2 w-full mt-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 bg-slate-700/50 rounded-lg" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {confirmDialog}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">{salonFilter ? 'Inbox' : 'Inbox (All Salons)'}</h1>
        <SalonLocationFilter salonFilter={salonFilter} setSalonFilter={v => { setSalonFilter(v); setSelected(null); }} salons={salons} setSalons={setSalons} adminFetch={adminFetch} />
      </div>
      {error && <div className="mb-4 p-3 bg-rose-500/10 text-rose-400 rounded-xl text-sm">{error}</div>}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Contact List */}
        <div className="lg:col-span-3 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden max-h-[75vh] overflow-y-auto">
          {contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <MessageSquare className="w-10 h-10 mb-2" />
              <p className="text-sm">No conversations</p>
            </div>
          ) : contacts.map((c: any) => (
            <button type="button" key={c.phone} onClick={() => selectContact(c)}
              className={`w-full text-left p-3 border-b border-slate-700 hover:bg-slate-700/50 transition-colors ${selected?.phone === c.phone ? 'bg-slate-700' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                  <Phone className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{c.name || c.phone}</p>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{c.lastMessage || 'No messages'}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {fmtDate(c.timestamp, 'MMM d, HH:mm')}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Chat Messages */}
        <div className="lg:col-span-5 bg-slate-800 rounded-xl border border-slate-700 flex flex-col min-h-[70vh] max-h-[75vh]">
          {!selected ? (
            <div className="flex flex-col items-center justify-center flex-1 text-slate-500">
              <MessageSquare className="w-12 h-12 mb-3" />
              <p className="text-sm font-medium">Select a conversation</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
                <span className="text-sm font-medium text-white truncate">{selected?.name || selected?.phone}</span>
                <button type="button" onClick={() => deleteConversation(selected.phone)}
                  className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all" title="Delete conversation">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500">
                    <p className="text-sm">No messages yet. Send a message below.</p>
                  </div>
                ) : messages.map((m: any, i: number) => (
                  <div key={m.id || i} className={`flex items-end gap-1 ${m.fromMe ? 'justify-end' : 'justify-start'}`}>
                    {m.fromMe && (
                    <button type="button" onClick={() => deleteMessage(m.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all opacity-0 hover:opacity-100"
                      title="Delete message">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <div className={`max-w-[80%] p-3 rounded-xl text-sm ${
                      m.fromMe ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-200'
                    }`}>
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      <p className="text-[10px] mt-1 opacity-60">
                        {fmtDate(m.timestamp, 'HH:mm')}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="p-3 border-t border-slate-700">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={msgText}
                    onChange={e => setMsgText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
                    placeholder={`Message ${selected?.name || selected?.phone || 'user'}...`}
                    className="flex-1 bg-slate-700 text-white text-sm rounded-lg px-4 py-2.5 border border-slate-600 focus:border-indigo-500 outline-none placeholder-slate-400"
                  />
                  <button type="button"
                    onClick={sendMessage}
                    disabled={sending || !msgText.trim()}
                    className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Customer Profile Panel */}
        <div className="lg:col-span-4 bg-slate-800 rounded-xl border border-slate-700 p-4 max-h-[75vh] overflow-y-auto">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <User className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm font-medium">Select a contact to view profile</p>
            </div>
          ) : profileLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
            </div>
          ) : profile ? (
            <div className="space-y-5">
              {/* Avatar & Name */}
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center justify-center text-2xl font-bold text-indigo-400 mb-3">
                  {(profile.customer.name || selected.name || '?').charAt(0).toUpperCase()}
                </div>
                <h2 className="text-lg font-bold text-white">{profile.customer.name || selected.name || 'Unknown'}</h2>
                <p className="text-sm text-slate-400 flex items-center gap-1 mt-1">
                  <Phone className="w-3 h-3" />
                  {profile.customer.phone}
                </p>
              </div>

              {/* Status Badge */}
              <div className="flex justify-center">
                {(() => {
                  const status = (profile.customer as any).status ?? 0;
                  const cfg: Record<number, { label: string; color: string }> = {
                    0: { label: 'New', color: 'bg-yellow-500/20 text-yellow-400' },
                    1: { label: 'Active', color: 'bg-emerald-500/20 text-emerald-400' },
                    2: { label: 'Inactive', color: 'bg-red-500/20 text-red-400' },
                  };
                  const c = cfg[status] || cfg[0];
                  return <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${c.color}`}>{c.label}</span>;
                })()}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-white">{profile.customer.total_visits || 0}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Visits</p>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-amber-400">{profile.customer.loyalty_points || 0}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Points</p>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-emerald-400">{(profile.appointments || []).filter((a: any) => a.status === 'completed').length}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Done</p>
                </div>
              </div>

              {/* Tags */}
              {profile.tags && profile.tags.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Tag className="w-3 h-3" /> Tags
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.tags.map((tag: string, i: number) => (
                      <span key={i} className="px-2.5 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-[11px] font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Member Since */}
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Clock className="w-3 h-3" />
                Member since {fmtDate(profile.customer.created_at, 'MMM yyyy', 'N/A')}
              </div>

              {/* Recent Appointments */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Recent Appointments
                </p>
                {(profile.appointments || []).length === 0 ? (
                  <p className="text-xs text-slate-500">No appointments yet</p>
                ) : (
                  <div className="space-y-2">
                    {profile.appointments.slice(0, 8).map((apt: any, i: number) => (
                      <div key={i} className="bg-slate-700/30 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-white">{apt.service_name}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            apt.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                            apt.status === 'cancelled' ? 'bg-rose-500/10 text-rose-400' :
                            'bg-amber-500/10 text-amber-400'
                          }`}>{apt.status}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400">
                          <span className="flex items-center gap-1"><User className="w-2.5 h-2.5" />{apt.barber_name}</span>
                          <span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5" />{apt.salon_name}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">
                          {fmtDate(apt.appointment_date ? apt.appointment_date + 'T' + (apt.appointment_time || '00:00') : null, 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <User className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-xs">No profile data found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
