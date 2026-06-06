import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Zap, Eye, EyeOff, Lock, Mail, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const ok = await login(email, password);
    setLoading(false);
    if (!ok) setError('Incorrect email or password. Default: admin@autozap.com / admin123');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-600 rounded-3xl mb-6 shadow-2xl shadow-indigo-900">
            <Zap className="w-10 h-10 text-white fill-current" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight">AutoZap</h1>
          <p className="text-indigo-300 mt-2 font-medium">Enterprise Salon Management</p>
        </div>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-[32px] p-10 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-2">Welcome Back</h2>
          <p className="text-indigo-200 text-sm mb-8">Sign in to your dashboard</p>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 p-4 bg-rose-500/20 border border-rose-400/30 rounded-2xl mb-6"
            >
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <p className="text-rose-200 text-sm">{error}</p>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-black text-indigo-200 uppercase tracking-widest">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-300" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@autozap.com"
                  className="w-full pl-12 pr-5 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-indigo-300 outline-none focus:border-indigo-400 focus:bg-white/20 transition-all font-medium"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-indigo-200 uppercase tracking-widest">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-300" />
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-14 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-indigo-300 outline-none focus:border-indigo-400 focus:bg-white/20 transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-300 hover:text-white transition-colors"
                >
                  {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-lg transition-all shadow-xl shadow-indigo-900/50 active:scale-95 disabled:opacity-60 flex items-center justify-center gap-3 mt-2"
            >
              {loading ? (
                <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Sign In to Dashboard'
              )}
            </button>
          </form>

          <p className="text-center text-indigo-300/60 text-xs mt-8">
            Default: admin@autozap.com · admin123
          </p>
        </div>
      </motion.div>
    </div>
  );
}
