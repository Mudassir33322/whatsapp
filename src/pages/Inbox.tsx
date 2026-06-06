import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Send, 
  Bot, 
  User, 
  CheckCircle2, 
  MoreVertical,
  Search,
  BotOff,
  Clock,
  Loader2
} from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { API_URL } from '../config';

interface ChatMessage {
  id: string;
  phone: string;
  text: string;
  fromMe: boolean;
  timestamp: string;
  pushName?: string;
}

interface ChatContact {
  phone: string;
  name: string;
  lastMessage: string;
  timestamp: string;
}

export function Inbox() {
   const { user } = useAuth();
   const sessionId = user?.uid || '';
   const { status, onMessage, sendMessage } = useSocket(sessionId);
  
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [activeContact, setActiveContact] = useState<ChatContact | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [botPaused, setBotPaused] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchContacts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/chats`);
      const data = await res.json();
      setContacts(data);
    } catch (error) {
      console.error('Failed to fetch contacts', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChatHistory = async (phone: string) => {
    try {
      const res = await fetch(`${API_URL}/api/chats/${phone}`);
      const data = await res.json();
      setMessages(data);
    } catch (error) {
      console.error('Failed to fetch history', error);
    }
  };

  const fetchBotStatus = async (phone: string) => {
    try {
      const res = await fetch(`${API_URL}/api/bot/status/${phone}`);
      const data = await res.json();
      setBotPaused(data.paused);
    } catch (error) {
      console.error('Failed to fetch bot status', error);
    }
  };

  const toggleBotStatus = async () => {
    if (!activeContact) return;
    try {
      const res = await fetch(`${API_URL}/api/bot/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: activeContact.phone, paused: !botPaused })
      });
      const data = await res.json();
      if (data.success) {
        setBotPaused(data.paused);
      }
    } catch (error) {
      console.error('Failed to toggle bot status', error);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  useEffect(() => {
    if (activeContact) {
      fetchChatHistory(activeContact.phone);
      fetchBotStatus(activeContact.phone);
    }
  }, [activeContact]);

  useEffect(() => {
    const unsubscribe = onMessage((data) => {
      console.log('Incoming socket message:', data);
      
      // Re-fetch contacts to update last message
      fetchContacts();
      
      // Update active chat if it matches
      // Robust comparison: check if one contains the other or they are equal
      const isMatch = activeContact && (
        data.sender === activeContact.phone || 
        data.sender.split('@')[0] === activeContact.phone.split('@')[0]
      );

      if (isMatch) {
        setMessages(prev => {
          // check if already exists to prevent duplicate
          if (prev.some(m => m.timestamp === data.timestamp && m.text === data.text)) {
            return prev;
          }
          return [...prev, {
            id: Date.now().toString() + Math.random(),
            phone: data.sender,
            text: data.text,
            fromMe: data.fromMe,
            timestamp: data.timestamp,
            pushName: data.pushName
          }];
        });
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [activeContact, onMessage]);

  useEffect(() => {
    // Scroll to bottom
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

   const handleSend = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!inputText.trim() || !activeContact) return;
     
     setSending(true);
     try {
       // Send message via socket
       sendMessage(sessionId, activeContact.phone, inputText);
       
       // Clear input optimistically
       setInputText('');
     } catch (error) {
       console.error('Failed to send message', error);
     } finally {
       setSending(false);
     }
   };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex rounded-3xl overflow-hidden border border-slate-200 bg-white shadow-xl shadow-indigo-50/20">
      
      {/* Sidebar / Contact List */}
      <div className="w-80 border-r border-slate-200 flex flex-col bg-slate-50/50">
        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search chats..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-100 border-none rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {contacts
            .filter(c => 
              c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              c.phone?.includes(searchTerm) ||
              c.lastMessage?.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .map(contact => (
            <button
              key={contact.phone}
              onClick={() => setActiveContact(contact)}
              className={`w-full p-4 flex items-start gap-3 border-b border-slate-100 transition-colors ${
                activeContact?.phone === contact.phone ? 'bg-indigo-50 hover:bg-indigo-50' : 'hover:bg-white'
              }`}
            >
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 shrink-0 font-bold">
                {contact.name[0]?.toUpperCase() || <User className="w-5 h-5" />}
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-bold text-slate-900 truncate pr-2">{contact.name}</h4>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {contact.timestamp ? format(new Date(contact.timestamp), 'HH:mm') : ''}
                  </span>
                </div>
                <p className="text-sm text-slate-500 truncate">{contact.lastMessage}</p>
              </div>
            </button>
          ))}

          {contacts.length === 0 && (
            <div className="p-8 text-center text-slate-400">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No messages yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-[#F0F2F5]">
        {activeContact ? (
          <>
            {/* Chat Header */}
            <header className="h-16 px-6 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-sm z-10">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                  {activeContact.name[0]?.toUpperCase() || <User className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{activeContact.name}</h3>
                  <p className="text-xs text-slate-500">{activeContact.phone}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={toggleBotStatus}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm ${
                    botPaused 
                      ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100' 
                      : 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  {botPaused ? (
                    <>
                      <BotOff className="w-4 h-4" />
                      Bot Paused
                    </>
                  ) : (
                    <>
                      <Bot className="w-4 h-4" />
                      Bot Active
                    </>
                  )}
                </button>
                <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg, index) => {
                const isFirstOfDay = index === 0 || (msg.timestamp && messages[index - 1]?.timestamp && new Date(msg.timestamp).getDate() !== new Date(messages[index - 1].timestamp).getDate());
                
                return (
                  <React.Fragment key={msg.id}>
                    {isFirstOfDay && (
                      <div className="flex justify-center my-6">
                        <span className="px-4 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-400 shadow-sm">
                          {format(new Date(msg.timestamp), 'MMMM d, yyyy')}
                        </span>
                      </div>
                    )}
                    <div className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                      <div 
                        className={`max-w-[70%] rounded-2xl px-5 py-3 shadow-sm relative group ${
                          msg.fromMe 
                            ? 'bg-indigo-600 text-white rounded-tr-sm' 
                            : 'bg-white border border-slate-200 text-slate-900 rounded-tl-sm'
                        }`}
                      >
                        <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        <div className={`flex items-center justify-end gap-1 mt-1 ${msg.fromMe ? 'text-indigo-200' : 'text-slate-400'}`}>
                          <span className="text-[10px] font-medium">
                            {format(new Date(msg.timestamp), 'HH:mm')}
                          </span>
                          {msg.fromMe && <CheckCircle2 className="w-3 h-3" />}
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-200 shrink-0">
              <form onSubmit={handleSend} className="flex items-center gap-3">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-slate-100 border-transparent focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-200 rounded-xl px-4 py-3 text-[15px] transition-all"
                />
                <button 
                  type="submit"
                  disabled={!inputText.trim() || sending}
                  className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-200 active:scale-95"
                >
                  {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-1" />}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
            <div className="w-24 h-24 bg-white border-2 border-slate-100 rounded-full flex items-center justify-center mb-6 shadow-sm">
              <MessageSquare className="w-10 h-10 text-indigo-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">AutoZap Web</h3>
            <p className="text-sm max-w-md text-center leading-relaxed">
              Select a conversation from the left to start chatting. You can pause the automated bot at any time to take over the conversation manually.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
