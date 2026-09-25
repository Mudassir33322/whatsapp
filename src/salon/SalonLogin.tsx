import React, { useState } from 'react';
import { useSalonAuth } from './SalonAuthContext';
import { Loader2, Scissors, Eye, EyeOff, Sparkles } from 'lucide-react';

export function SalonLogin() {
  const { login } = useSalonAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (!result.ok) setError(result.error || 'Login failed');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-200/30 via-transparent to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-amber-100/40 to-transparent" />
      
      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-200 rounded-2xl mb-4">
            <Scissors className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800">Salon Portal</h1>
          <p className="text-slate-500 mt-2">Apne salon ka premium management</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl shadow-amber-100/50 border border-amber-100 p-8 space-y-5">
          <div className="flex items-center gap-2 justify-center mb-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h2 className="text-xl font-bold text-slate-800">Sign In</h2>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>

          {error && (
            <div className="bg-rose-50 text-rose-600 text-sm px-4 py-3 rounded-xl border border-rose-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-amber-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none transition-all bg-white/50"
              placeholder="you@salon.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-amber-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none transition-all bg-white/50 pr-12"
                placeholder="••••••••"
                required
              />
              <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-amber-200"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
