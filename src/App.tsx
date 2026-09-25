import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Lock, Mail, Eye, EyeOff, AlertCircle, Store, Shield, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { API_URL } from './config';
import { ThemeProvider } from './components/ThemeContext';
import { I18nProvider } from './i18n';

export default function App() {
  const [loginType, setLoginType] = useState<'admin' | 'salon'>('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = loginType === 'admin'
        ? `${API_URL}/api/admin/auth/login`
        : `${API_URL}/api/salon/auth/login`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) {
          const retryAfter = res.headers.get('Retry-After');
          let retryMsg = 'Too many attempts. Please try again later.';
          if (retryAfter) {
            const seconds = parseInt(retryAfter, 10);
            if (!isNaN(seconds)) {
              if (seconds >= 60) retryMsg = `Too many attempts. Please try again after ${Math.ceil(seconds / 60)} minute(s).`;
              else retryMsg = `Too many attempts. Please try again after ${seconds} second(s).`;
            }
          }
          setError(data.error || retryMsg);
        }
        else setError(data.error || 'Invalid credentials');
        setLoading(false);
        return;
      }
      setLoading(false);
      if (loginType === 'admin') {
        localStorage.setItem('admin-token', data.token);
        localStorage.setItem('admin-user', JSON.stringify(data.admin));
        navigate('/admin/');
      } else {
        localStorage.setItem('salon-token', data.token);
        localStorage.setItem('salon-user', JSON.stringify(data.salon));
        navigate('/salon/');
      }
    } catch {
      setError('Network error. Could not connect to server.');
      setLoading(false);
    }
  };

  return (
    <I18nProvider>
    <ThemeProvider>
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/25 mb-4"
          >
            <Zap className="w-8 h-8 text-white fill-current" />
          </motion.div>
          <h1 className="text-3xl font-bold text-white tracking-tight">AutoZap</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          {/* Tabs */}
          <div className="flex bg-slate-800/50 rounded-xl p-1 mb-6">
            <button type="button"
              onClick={() => { setLoginType('admin'); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                loginType === 'admin'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Shield className="w-4 h-4" />
              Admin Access
            </button>
            <button type="button"
              onClick={() => { setLoginType('salon'); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                loginType === 'salon'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Store className="w-4 h-4" />
              Salon Access
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3"
              >
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white rounded-lg font-semibold text-sm transition-all shadow-lg shadow-indigo-500/25"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Sign In
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
    </ThemeProvider>
    </I18nProvider>
  );
}
