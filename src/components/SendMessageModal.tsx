import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Send, X } from 'lucide-react';

interface SendMessageModalProps {
  initialPhone?: string;
  onClose: () => void;
  onSend: (to: string, msg: string) => void;
}

export function SendMessageModal({ initialPhone = '', onClose, onSend }: SendMessageModalProps) {
  const [phone, setPhone] = useState(initialPhone);
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !message) return;
    
    // Simple sanitization for WhatsApp (remove +, spaces)
    let sanitizedPhone = phone.replace(/[^\d]/g, '');
    if (!sanitizedPhone.endsWith('@s.whatsapp.net')) {
        sanitizedPhone = `${sanitizedPhone}@s.whatsapp.net`;
    }
    
    onSend(sanitizedPhone, message);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="p-6 bg-indigo-600 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Send Message</h3>
              <p className="text-indigo-100 text-xs">Direct API Test</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Recipient Number</label>
            <input 
              type="text" 
              placeholder="e.g. 923001234567" 
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Message Content</label>
            <textarea 
              placeholder="Type your message here..." 
              rows={4}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />
          </div>

          <div className="pt-4">
            <button 
              type="submit"
              className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-[0.98]"
            >
              Send Now
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
