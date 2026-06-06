import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, QrCode, Users, Calendar, Zap, 
  MessageSquare, Settings, DollarSign, LogOut,
  ChevronRight, Loader2, X, Activity, UserCircle, Moon, Sun
} from 'lucide-react';
import { Dashboard } from './pages/Dashboard';
import { LiveQR } from './pages/LiveQR';
import { CRM } from './pages/CRM';
import { Bookings } from './pages/Bookings';
import { Automations } from './pages/Automations';
import { Inbox } from './pages/Inbox';
import { Finances } from './pages/Finances';
import { Management } from './pages/Management';
import { Profile } from './pages/Profile';
import { Login } from './pages/Login';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { SocketProvider } from './context/SocketContext';
import { WhatsAppManager } from './components/WhatsAppManager';
import { useSocket } from './hooks/useSocket';
import { ErrorBoundary } from './components/ErrorBoundary';

type Page = 'dashboard' | 'qr' | 'crm' | 'bookings' | 'automations' | 'inbox' | 'finances' | 'management' | 'profile';

function SocketEventListener({ setToast, setConnected }: { setToast: (toast: { sender: string, text: string } | null) => void, setConnected: (c: boolean) => void }) {
  const { socket, onMessage } = useSocket();
  React.useEffect(() => {
    const unsub = onMessage((data) => {
      if (!data.fromMe) {
        setToast({ sender: data.pushName || data.sender, text: data.text });
        setTimeout(() => setToast(null), 5000);
      }
    });
    if (socket) {
      const onConnect = () => setConnected(true);
      const onDisconnect = () => setConnected(false);
      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      setConnected(socket.connected);
      return () => {
        if (unsub) unsub();
        socket.off('connect', onConnect);
        socket.off('disconnect', onDisconnect);
      };
    }
    return () => { if (unsub) unsub(); };
  }, [socket, onMessage, setToast, setConnected]);
  return null;
}

function AppContent() {
  const { user, loading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [toast, setToast] = useState<{ sender: string, text: string } | null>(null);
  const [waStatus, setWaStatus] = useState({ connected: false, loading: true });
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!user) return <Login />;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'crm', label: 'CRM Automation', icon: Users },
    { id: 'bookings', label: 'Booking System', icon: Calendar },
    { id: 'automations', label: 'Workflows', icon: Zap },
    { id: 'inbox', label: 'Live Inbox', icon: MessageSquare },
    { id: 'finances', label: 'Finances & Stock', icon: DollarSign },
    { id: 'management', label: 'Management', icon: Settings },
  ];

  const avatarInitials = user.avatarInitials || user.displayName?.split(' ').map(n => n[0]).join('') || 'AU';

  return (
    <SocketProvider sessionId={user.uid}>
      <SocketEventListener setToast={setToast} setConnected={(c) => setWaStatus({ connected: c, loading: false })} />
      <div className={`flex h-screen ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-[#F9FAFB] text-slate-900'} font-sans`}>
        <WhatsAppManager />
        {/* ... rest of the component ... */}

      {/* Sidebar */}
      <aside className={`w-64 border-r flex flex-col ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
            <Zap className="w-6 h-6 fill-current" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">AutoZap <span className="text-indigo-600">Enterprise</span></h1>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id as Page)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                activePage === item.id
                  ? (theme === 'dark' ? 'bg-indigo-600/30 text-indigo-400 shadow-sm' : 'bg-indigo-50 text-indigo-700 shadow-sm')
                  : `${theme === 'dark' ? 'text-slate-400 hover:bg-slate-700 hover:text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium text-sm">{item.label}</span>
              {activePage === item.id && (
                <motion.div layoutId="nav-pill" className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-600" />
              )}
            </button>
          ))}
        </nav>

        {/* Profile Area */}
        <div className={`p-4 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-slate-100'}`}>
          <div className="relative">
            <button
              onClick={() => setProfileMenuOpen(o => !o)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}
            >
              <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold ring-2 ring-indigo-500/20">
                {avatarInitials}
              </div>
              <div className="flex-1 overflow-hidden text-left">
                <p className="text-xs font-semibold truncate">{user.displayName}</p>
                <p className="text-[10px] text-slate-400 truncate uppercase tracking-wide">{user.role || 'Admin'}</p>
              </div>
              <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
            </button>

            {/* Profile Dropdown */}
            <AnimatePresence>
              {profileMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className={`absolute bottom-full left-0 right-0 mb-2 rounded-2xl border shadow-xl overflow-hidden ${theme === 'dark' ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-100'}`}
                >
                  <button
                    onClick={() => { setActivePage('profile'); setProfileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-colors ${theme === 'dark' ? 'text-slate-200 hover:bg-slate-600' : 'text-slate-700 hover:bg-slate-50'}`}
                  >
                    <UserCircle className="w-4 h-4 text-indigo-500" />
                    Profile & Settings
                  </button>
                  <button
                    onClick={toggleTheme}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-colors ${theme === 'dark' ? 'text-slate-200 hover:bg-slate-600' : 'text-slate-700 hover:bg-slate-50'}`}
                  >
                    {theme === 'dark' ? <Sun className="w-4 h-4 text-yellow-500" /> : <Moon className="w-4 h-4 text-indigo-500" />}
                    {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                  </button>
                  <div className={`h-px ${theme === 'dark' ? 'bg-slate-600' : 'bg-slate-100'}`} />
                  <button
                    onClick={() => { logout(); setProfileMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-rose-500 hover:bg-rose-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className={`h-16 border-b flex items-center justify-between px-8 sticky top-0 z-10 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2 text-slate-400">
            <span className="text-sm">AutoZap</span>
            <ChevronRight className="w-4 h-4" />
            <span className={`text-sm font-medium capitalize ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {activePage.replace('-', ' ')}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${waStatus.connected ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${waStatus.connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              {waStatus.loading ? 'Syncing...' : waStatus.connected ? 'WhatsApp Connected' : 'WhatsApp Disconnected'}
            </div>
          </div>
        </header>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              className="fixed top-20 right-8 z-50 bg-white border border-slate-200 p-4 rounded-2xl shadow-2xl shadow-indigo-100/50 flex items-start gap-4 max-w-sm cursor-pointer"
              onClick={() => { setActivePage('inbox'); setToast(null); }}
            >
              <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-slate-900 truncate">New: {toast.sender}</h4>
                <p className="text-xs text-slate-500 truncate mt-0.5">{toast.text}</p>
              </div>
              <button onClick={e => { e.stopPropagation(); setToast(null); }} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activePage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activePage === 'dashboard' && <Dashboard />}
              {activePage === 'qr' && <LiveQR />}
              {activePage === 'crm' && <CRM />}
              {activePage === 'bookings' && <Bookings />}
              {activePage === 'automations' && <Automations />}
              {activePage === 'inbox' && <Inbox />}
              {activePage === 'finances' && <Finances />}
              {activePage === 'management' && <Management />}
              {activePage === 'profile' && <Profile />}
            </motion.div>
          </AnimatePresence>
          </div>
          </main>
          </div>
          </SocketProvider>
          );
          }
export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
