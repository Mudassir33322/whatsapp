import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  User, Mail, Phone, Lock, Eye, EyeOff, Moon, Sun,
  Save, ShieldCheck, LogOut, CheckCircle
} from 'lucide-react';
import { motion } from 'motion/react';

export function Profile() {
  const { user, logout, updateProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [tab, setTab] = useState<'profile' | 'security' | 'appearance'>('profile');
  const [saved, setSaved] = useState(false);

  const [profileForm, setProfileForm] = useState({
    displayName: user?.displayName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    role: user?.role || 'Administrator'
  });

  const [secForm, setSecForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPass, setShowPass] = useState(false);
  const [secError, setSecError] = useState('');
  const [secSuccess, setSecSuccess] = useState('');

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({ displayName: profileForm.displayName, phone: profileForm.phone });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setSecError('');
    setSecSuccess('');
    const stored = localStorage.getItem('autozap-creds');
    const creds = stored ? JSON.parse(stored) : { email: 'admin@autozap.com', password: 'admin123' };
    if (secForm.currentPassword !== creds.password) {
      setSecError('Current password is incorrect.');
      return;
    }
    if (secForm.newPassword.length < 6) {
      setSecError('New password must be at least 6 characters.');
      return;
    }
    if (secForm.newPassword !== secForm.confirmPassword) {
      setSecError('Passwords do not match.');
      return;
    }
    localStorage.setItem('autozap-creds', JSON.stringify({ email: user?.email || creds.email, password: secForm.newPassword }));
    setSecSuccess('Password changed successfully!');
    setSecForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Account & Settings</h2>
          <p className="text-slate-500 mt-1">Manage your profile, security, and appearance.</p>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 px-5 py-3 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-all font-bold border border-rose-100"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>

      {/* Avatar Card */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[32px] p-8 text-white flex items-center gap-6">
        <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center text-3xl font-black">
          {user?.avatarInitials || user?.displayName?.charAt(0) || 'A'}
        </div>
        <div>
          <h3 className="text-2xl font-bold">{user?.displayName}</h3>
          <p className="text-indigo-200 mt-1">{user?.email}</p>
          <span className="inline-block mt-2 px-3 py-1 bg-white/20 rounded-full text-xs font-black uppercase tracking-widest">{user?.role || 'Administrator'}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-50 px-4">
          {[
            { id: 'profile', label: 'Profile Info', icon: User },
            { id: 'security', label: 'Security', icon: ShieldCheck },
            { id: 'appearance', label: 'Appearance', icon: theme === 'dark' ? Moon : Sun }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`px-8 py-5 text-sm font-black uppercase tracking-widest transition-all relative flex items-center gap-2 ${tab === t.id ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-700'}`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              {tab === t.id && <motion.div layoutId="profile-tab" className="absolute bottom-0 left-6 right-6 h-0.5 bg-indigo-600 rounded-t-full" />}
            </button>
          ))}
        </div>

        <div className="p-10 max-w-2xl">
          {tab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Display Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input
                      type="text" required
                      value={profileForm.displayName}
                      onChange={e => setProfileForm({ ...profileForm, displayName: e.target.value })}
                      className="w-full pl-11 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                      placeholder="+92 300 0000000"
                      className="w-full pl-11 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Email (read-only)</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input type="email" value={profileForm.email} disabled
                    className="w-full pl-11 pr-4 py-4 bg-slate-100 border-2 border-transparent rounded-2xl outline-none font-bold text-slate-400 cursor-not-allowed"
                  />
                </div>
              </div>
              <button type="submit" className="flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-slate-900 transition-all shadow-xl shadow-indigo-100 active:scale-95">
                {saved ? <CheckCircle className="w-5 h-5" /> : <Save className="w-5 h-5" />}
                {saved ? 'Saved!' : 'Save Profile'}
              </button>
            </form>
          )}

          {tab === 'security' && (
            <form onSubmit={handleChangePassword} className="space-y-6">
              <p className="text-sm text-slate-500 leading-relaxed">Change your admin password. Make sure to remember your new password.</p>
              {secError && <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl text-sm font-bold border border-rose-100">{secError}</div>}
              {secSuccess && <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl text-sm font-bold border border-emerald-100">{secSuccess}</div>}
              {['currentPassword', 'newPassword', 'confirmPassword'].map((field, i) => (
                <div key={field} className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    {field === 'currentPassword' ? 'Current Password' : field === 'newPassword' ? 'New Password' : 'Confirm New Password'}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input
                      type={showPass ? 'text' : 'password'} required
                      value={(secForm as any)[field]}
                      onChange={e => setSecForm({ ...secForm, [field]: e.target.value })}
                      className="w-full pl-11 pr-12 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold"
                    />
                    {i === 0 && (
                      <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600">
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button type="submit" className="flex items-center gap-2 px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-indigo-600 transition-all shadow-xl active:scale-95">
                <ShieldCheck className="w-5 h-5" />
                Update Password
              </button>
            </form>
          )}

          {tab === 'appearance' && (
            <div className="space-y-8">
              <p className="text-sm text-slate-500">Customize the dashboard theme and layout appearance.</p>
              <div className="flex items-center justify-between p-6 bg-slate-50 border border-slate-100 rounded-2xl">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${theme === 'dark' ? 'bg-slate-800 text-yellow-400' : 'bg-indigo-50 text-indigo-600'}`}>
                    {theme === 'dark' ? <Moon className="w-6 h-6" /> : <Sun className="w-6 h-6" />}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">Theme Mode</p>
                    <p className="text-sm text-slate-500">Currently: {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</p>
                  </div>
                </div>
                <button
                  onClick={toggleTheme}
                  className={`relative w-14 h-7 rounded-full transition-all ${theme === 'dark' ? 'bg-indigo-600' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all ${theme === 'dark' ? 'left-7' : 'left-0.5'}`} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
