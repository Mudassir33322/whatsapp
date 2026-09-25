import React, { useState } from 'react';
import { useCustomerAuth } from './CustomerAuthContext';
import { UserCircle, Phone, Mail, Star, Save, Loader2, Lock, CheckCircle, XCircle } from 'lucide-react';
import { API_URL } from '../config';

export function CustomerProfile() {
  const { customer, updateProfile } = useCustomerAuth();
  const [name, setName] = useState(customer?.name || '');
  const [email, setEmail] = useState(customer?.email || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMessage, setPwdMessage] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setSaving(true);
    const ok = await updateProfile({ name, email });
    setSaving(false);
    if (ok) {
      setMessage('Profile updated successfully');
    } else {
      setMessage('Failed to update profile');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMessage('');
    if (!currentPassword || !newPassword) {
      setPwdMessage('Dono fields required hain');
      return;
    }
    if (newPassword.length < 6) {
      setPwdMessage('Password kam se kam 6 characters ka ho');
      return;
    }
    setPwdSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/customer/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('customer-token')}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setPwdMessage('Password successfully change ho gaya');
        setCurrentPassword('');
        setNewPassword('');
        setShowPasswordForm(false);
      } else {
        setPwdMessage(data.error || 'Password change failed');
      }
    } catch {
      setPwdMessage('Network error');
    } finally {
      setPwdSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">My Profile</h1>

      <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-white/10">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
            <UserCircle className="w-8 h-8 text-white" />
          </div>
          <div>
            <div className="text-white font-semibold text-lg">{customer?.name || 'Customer'}</div>
            <div className="text-slate-400 text-sm">{customer?.phone}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-slate-300">
          <Phone className="w-5 h-5 text-indigo-400" />
          <span>{customer?.phone}</span>
        </div>

        {customer?.email && (
          <div className="flex items-center gap-3 text-slate-300">
            <Mail className="w-5 h-5 text-indigo-400" />
            <span>{customer.email}</span>
          </div>
        )}

        <div className="flex items-center gap-3 text-slate-300">
          <Star className="w-5 h-5 text-amber-400" />
          <span>{customer?.loyalty_points ?? 0} loyalty points</span>
        </div>
      </div>

      <form onSubmit={handleSave} className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-bold text-white">Edit Profile</h2>

        {message && (
          <div className={`text-sm px-4 py-3 rounded-xl border ${message.includes('success') ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-rose-500/10 text-rose-300 border-rose-500/20'}`}>
            {message}
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-1.5">Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-4 py-3 bg-white/10 border border-white/20 text-white rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder-slate-400"
            placeholder="Your name"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-white/10 border border-white/20 text-white rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder-slate-400"
            placeholder="email@example.com"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Changes</>}
        </button>
      </form>

      <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-indigo-400" />
            Change Password
          </h2>
          {!showPasswordForm && (
            <button
              type="button"
              onClick={() => setShowPasswordForm(true)}
              className="px-4 py-2 text-sm font-semibold text-indigo-300 hover:text-indigo-200 border border-indigo-500/30 rounded-xl hover:bg-indigo-500/10 transition-all"
            >
              Change Password
            </button>
          )}
        </div>

        {pwdMessage && (
          <div className={`text-sm px-4 py-3 rounded-xl border ${pwdMessage.includes('success') ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-rose-500/10 text-rose-300 border-rose-500/20'}`}>
            {pwdMessage}
          </div>
        )}

        {showPasswordForm && (
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1.5">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 text-white rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder-slate-400"
                placeholder="Current password"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1.5">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 text-white rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder-slate-400"
                placeholder="New password (min 6 characters)"
                minLength={6}
                required
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setShowPasswordForm(false); setPwdMessage(''); }}
                className="flex-1 px-4 py-2.5 border border-white/20 text-slate-300 rounded-xl text-sm font-semibold hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pwdSaving}
                className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {pwdSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Lock className="w-4 h-4" /> Update Password</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
