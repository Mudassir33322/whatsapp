import React, { useState } from 'react';
import { useAdminAuth } from './AdminAuthContext';
import { Loader2, Shield, Eye, EyeOff, Lock } from 'lucide-react';

export function AdminLogin() {
  const { login } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    const ok = await login(email, password);
    setLoading(false);
    if (!ok) setError('Invalid credentials');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl" />

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20 rounded-2xl mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Admin Panel</h1>
          <p className="text-slate-400 mt-2">Platform administration & management</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-slate-800/60 backdrop-blur-xl rounded-3xl shadow-2xl shadow-indigo-500/10 border border-slate-700/50 p-8 space-y-5">
          <div className="flex items-center gap-2 justify-center mb-2">
            <Lock className="w-4 h-4 text-indigo-400" />
            <h2 className="text-xl font-bold text-white">Sign In</h2>
          </div>
          {error && <div className="bg-rose-500/10 text-rose-400 text-sm px-4 py-3 rounded-xl border border-rose-500/20">{error}</div>}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1.5">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-700/50 border border-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-white placeholder-slate-400"
              required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1.5">Password</label>
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-700/50 border border-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-white placeholder-slate-400 pr-12"
                required />
              <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
