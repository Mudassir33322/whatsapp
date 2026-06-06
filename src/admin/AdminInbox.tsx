import { useState, useEffect } from 'react';
import { MessageSquare, Phone, Calendar, Loader2, User, Tag, Star, Clock, MapPin } from 'lucide-react';
import { format } from 'date-fns';

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
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const hd = () => ({ Authorization: `Bearer ${localStorage.getItem('admin-token')}`, 'Content-Type': 'application/json' });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/chats', { headers: hd() });
        if (res.ok) setContacts(await res.json());
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const loadMessages = async (phone: string) => {
    try {
      const res = await fetch(`/api/admin/chats/${phone}/messages`, { headers: hd() });
      if (res.ok) setMessages(await res.json());
    } catch {}
  };

  const loadProfile = async (phone: string) => {
    setProfileLoading(true);
    setProfile(null);
    try {
      const res = await fetch(`/api/admin/customers/${encodeURIComponent(phone)}`, { headers: hd() });
      if (res.ok) setProfile(await res.json());
    } catch {} finally { setProfileLoading(false); }
  };

  const selectContact = (c: any) => {
    setSelected(c);
    loadMessages(c.phone);
    loadProfile(c.phone);
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Inbox (All Salons)</h1>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Contact List */}
        <div className="lg:col-span-3 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden max-h-[75vh] overflow-y-auto">
          {contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <MessageSquare className="w-10 h-10 mb-2" />
              <p className="text-sm">No conversations</p>
            </div>
          ) : contacts.map((c: any) => (
            <button key={c.phone} onClick={() => selectContact(c)}
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
                    {c.timestamp ? format(new Date(c.timestamp), 'MMM d, HH:mm') : ''}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Chat Messages */}
        <div className="lg:col-span-5 bg-slate-800 rounded-xl border border-slate-700 p-4 min-h-[70vh] max-h-[75vh] overflow-y-auto">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <MessageSquare className="w-12 h-12 mb-3" />
              <p className="text-sm font-medium">Select a conversation</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <p className="text-sm">No messages in this conversation</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((m: any, i: number) => (
                <div key={i} className={`flex ${m.fromMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-xl text-sm ${
                    m.fromMe ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-200'
                  }`}>
                    <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    <p className="text-[10px] mt-1 opacity-60">
                      {m.timestamp ? format(new Date(m.timestamp), 'HH:mm') : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
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
                  const status = profile.customer.status ?? 0;
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
                  <p className="text-lg font-bold text-emerald-400">{profile.appointments.filter((a: any) => a.status === 'completed').length}</p>
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
                Member since {profile.customer.created_at ? format(new Date(profile.customer.created_at), 'MMM yyyy') : 'N/A'}
              </div>

              {/* Recent Appointments */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Recent Appointments
                </p>
                {profile.appointments.length === 0 ? (
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
                          {apt.appointment_date ? format(new Date(apt.appointment_date + 'T' + (apt.appointment_time || '00:00')), 'MMM d, yyyy h:mm a') : ''}
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
