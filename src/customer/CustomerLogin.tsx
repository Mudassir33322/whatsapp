import React, { useState } from 'react';
import { useCustomerAuth } from './CustomerAuthContext';
import { Phone, MessageSquare, Shield, KeyRound, Loader2, Lock, CheckCircle } from 'lucide-react';

export function CustomerLogin() {
  const { loginPhone, verifyOtp, loginPassword, setPassword } = useCustomerAuth();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPwd] = useState('');
  const [newPassword, setNewPwd] = useState('');
  const [step, setStep] = useState<'password' | 'phone' | 'otp' | 'set-password' | 'success'>('phone');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isValidPhone = (p: string) => /^\d{10,15}$/.test(p);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isValidPhone(phone)) { setError('Valid phone number daalein'); return; }
    if (!password) { setError('Password daalein'); return; }
    setLoading(true);
    const ok = await loginPassword(phone, password);
    setLoading(false);
    if (!ok) setError('Phone ya password galat hai. Password bhool gaye to OTP se login karein');
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isValidPhone(phone)) { setError('Valid phone number daalein'); return; }
    setLoading(true);
    const result = await loginPhone(phone);
    setLoading(false);
    if (result.success) {
      setStep('otp');
    } else {
      setError(result.message || 'OTP bhejne mein masla hai');
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (code.length < 4) { setError('4-digit code daalein'); return; }
    setLoading(true);
    const result = await verifyOtp(phone, code);
    setLoading(false);
    if (!result.success) { setError('Invalid verification code'); return; }
    if (result.needsPassword) {
      setStep('set-password');
    } else {
      setStep('success');
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) { setError('Password kam se kam 6 characters ka ho'); return; }
    setLoading(true);
    const ok = await setPassword(newPassword);
    setLoading(false);
    if (ok) {
      setStep('success');
    } else {
      setError('Password set karne mein masla hai');
    }
  };

  const bg = 'bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900';

  if (step === 'success') {
    return (
      <div className={`min-h-screen ${bg} flex items-center justify-center p-4`}>
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-2xl mb-4 shadow-lg shadow-green-500/20">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Welcome!</h2>
          <p className="text-indigo-200">Aap login ho gaye hain</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bg} flex items-center justify-center p-4`}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl mb-4 shadow-lg shadow-indigo-500/20">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Customer Portal</h1>
          <p className="text-indigo-200 mt-2">Book appointments & track services</p>
        </div>

        {step === 'password' && (
          <form onSubmit={handlePasswordLogin} className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 space-y-5">
            <h2 className="text-xl font-bold text-white text-center">Password se Login</h2>
            {error && <div className="bg-rose-500/10 text-rose-300 text-sm px-4 py-3 rounded-xl border border-rose-500/20">{error}</div>}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1.5">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 text-white rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder-slate-400"
                  placeholder="923001234567" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input type="password" value={password} onChange={e => setPwd(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 text-white rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder-slate-400"
                  placeholder="Enter password" required />
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Logging in...' : 'Login'}
            </button>
            <button type="button" onClick={() => { setStep('phone'); setError(''); setPwd(''); }}
              className="w-full text-sm text-slate-400 hover:text-white transition-colors">
              Password bhool gaye? OTP se login karein
            </button>
          </form>
        )}

        {step === 'phone' && (
          <form onSubmit={handleSendOtp} className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 space-y-5">
            <h2 className="text-xl font-bold text-white text-center">OTP se Login</h2>
            {error && <div className="bg-rose-500/10 text-rose-300 text-sm px-4 py-3 rounded-xl border border-rose-500/20">{error}</div>}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1.5">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 text-white rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder-slate-400"
                  placeholder="923001234567" required />
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
            <button type="button" onClick={() => { setStep('password'); setError(''); }}
              className="w-full text-sm text-slate-400 hover:text-white transition-colors">
              Password hai? Password se login karein
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerify} className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 space-y-5">
            <div className="flex items-center gap-2 justify-center">
              <Shield className="w-5 h-5 text-indigo-400" />
              <h2 className="text-xl font-bold text-white">Verify OTP</h2>
            </div>
            <p className="text-slate-400 text-sm text-center">
              Code sent to <span className="text-white font-medium">{phone}</span>
            </p>
            {error && <div className="bg-rose-500/10 text-rose-300 text-sm px-4 py-3 rounded-xl border border-rose-500/20">{error}</div>}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1.5">6-Digit Code</label>
              <input type="text" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 text-white rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder-slate-400 text-center text-2xl tracking-[0.5em]"
                placeholder="0 0 0 0 0 0" maxLength={6} inputMode="numeric" required />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Verifying...' : 'Verify'}
            </button>
            <button type="button" onClick={() => { setStep('phone'); setCode(''); setError(''); }}
              className="w-full text-sm text-slate-400 hover:text-white transition-colors">
              Change phone number
            </button>
          </form>
        )}

        {step === 'set-password' && (
          <form onSubmit={handleSetPassword} className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 space-y-5">
            <div className="flex items-center gap-2 justify-center">
              <KeyRound className="w-5 h-5 text-indigo-400" />
              <h2 className="text-xl font-bold text-white">Set Password</h2>
            </div>
            <p className="text-slate-400 text-sm text-center">
              Apne account ke liye password set karein. Agli baar aap password se login kar sakte hain.
            </p>
            {error && <div className="bg-rose-500/10 text-rose-300 text-sm px-4 py-3 rounded-xl border border-rose-500/20">{error}</div>}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1.5">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input type="password" value={newPassword} onChange={e => setNewPwd(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 text-white rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder-slate-400"
                  placeholder="Kam se kam 6 characters" minLength={6} required />
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Setting...' : 'Set Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}