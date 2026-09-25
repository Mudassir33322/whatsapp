import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutDashboard, MapPin, Store, Calendar, UserCircle, DollarSign, Package, LogOut, Shield, ChevronRight, Users, QrCode, Smartphone, Crown, Activity, MessageSquare, ClipboardList, Menu, X, Settings, Download, Loader2, Search, Sun, Moon } from 'lucide-react';
import { useAdminAuth } from './AdminAuthContext';
import { useTheme } from '../components/ThemeContext';
import { useT, LanguageToggle } from '../i18n';

const AdminDashboard = lazy(() => import('./AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AdminLocations = lazy(() => import('./AdminLocations').then(m => ({ default: m.AdminLocations })));
const AdminSalons = lazy(() => import('./AdminSalons').then(m => ({ default: m.AdminSalons })));
const AdminInbox = lazy(() => import('./AdminInbox').then(m => ({ default: m.AdminInbox })));
const AdminCalendar = lazy(() => import('./AdminCalendar').then(m => ({ default: m.AdminCalendar })));
const AdminCRM = lazy(() => import('./AdminCRM').then(m => ({ default: m.AdminCRM })));
const AdminAppointments = lazy(() => import('./AdminAppointments').then(m => ({ default: m.AdminAppointments })));
const AdminCustomers = lazy(() => import('./AdminCustomers').then(m => ({ default: m.AdminCustomers })));
const AdminFinances = lazy(() => import('./AdminFinances').then(m => ({ default: m.AdminFinances })));
const AdminInventory = lazy(() => import('./AdminInventory').then(m => ({ default: m.AdminInventory })));
const AdminManage = lazy(() => import('./AdminManage').then(m => ({ default: m.AdminManage })));
const AdminLiveQR = lazy(() => import('./AdminLiveQR').then(m => ({ default: m.AdminLiveQR })));
const AdminWhatsApp = lazy(() => import('./AdminWhatsApp').then(m => ({ default: m.AdminWhatsApp })));
const AdminSettings = lazy(() => import('./AdminSettings').then(m => ({ default: m.AdminSettings })));
const AdminAudit = lazy(() => import('./AdminAudit').then(m => ({ default: m.AdminAudit })));

const superAdminNav = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'inbox', label: 'Inbox', icon: MessageSquare },
  { id: 'locations', label: 'Locations', icon: MapPin },
  { id: 'salons', label: 'Salons', icon: Store },
  { id: 'admins', label: 'Admins', icon: Crown },
  { id: 'appointments', label: 'Appointments', icon: ClipboardList },
  { id: 'customers', label: 'Customers', icon: UserCircle },
  { id: 'crm', label: 'CRM', icon: Users },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'finances', label: 'Finances', icon: DollarSign },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'audit', label: 'Audit Log', icon: ClipboardList },
  { id: 'qr', label: 'Live QR', icon: QrCode },
  { id: 'sessions', label: 'Sessions', icon: Smartphone },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const adminNav = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'inbox', label: 'Inbox', icon: MessageSquare },
  { id: 'locations', label: 'Locations', icon: MapPin },
  { id: 'salons', label: 'Salons', icon: Store },
  { id: 'appointments', label: 'Appointments', icon: ClipboardList },
  { id: 'customers', label: 'Customers', icon: UserCircle },
  { id: 'crm', label: 'CRM', icon: Users },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'finances', label: 'Finances', icon: DollarSign },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'audit', label: 'Audit Log', icon: ClipboardList },
];

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button type="button" onClick={toggle} title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
      className="p-2 bg-slate-700/30 hover:bg-slate-600/40 text-slate-300 hover:text-white rounded-xl transition-all">
      {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

interface SearchResult {
  type: 'salon' | 'customer' | 'admin';
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

type SearchFilter = 'all' | 'salon' | 'customer' | 'admin';

function GlobalSearch({ adminFetch, onNavigate, isSuperAdmin }: { adminFetch: (i: RequestInfo | URL, init?: RequestInit) => Promise<Response>; onNavigate: (page: string) => void; isSuperAdmin: boolean }) {
  const t = useT();
  const [filter, setFilter] = useState<SearchFilter>('all');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const filterList = (list: any[], term: string, fields: string[]): any[] =>
    (Array.isArray(list) ? list : [])
      .filter((x) => fields.some((f) => (x?.[f] || '').toString().toLowerCase().includes(term)))
      .slice(0, 5);

  const run = async (query: string) => {
    const term = query.trim().toLowerCase();
    if (!term) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const out: SearchResult[] = [];
      const wantSalon = filter === 'all' || filter === 'salon';
      const wantCustomer = filter === 'all' || filter === 'customer';
      const wantAdmin = (filter === 'all' || filter === 'admin') && isSuperAdmin;

      const tasks: Promise<void>[] = [];
      if (wantCustomer) {
        tasks.push(adminFetch(`/api/admin/customers?search=${encodeURIComponent(term)}`).then(async (r) => {
          if (!r.ok) return;
          const d = await r.json();
          filterList(d.customers || d, term, ['customer_name', 'customer_phone']).forEach((c: any) =>
            out.push({ type: 'customer', id: c.customer_phone || String(c.id), name: c.customer_name || 'Unknown', phone: c.customer_phone }));
        }).catch(() => {}));
      }
      if (wantSalon) {
        tasks.push(adminFetch(`/api/admin/salons`).then(async (r) => {
          if (!r.ok) return;
          const list = await r.json();
          filterList(list, term, ['name', 'owner_name', 'phone', 'email']).forEach((s: any) =>
            out.push({ type: 'salon', id: String(s.id), name: s.name, phone: s.phone, email: s.email }));
        }).catch(() => {}));
      }
      if (wantAdmin) {
        tasks.push(adminFetch(`/api/admin/admins`).then(async (r) => {
          if (!r.ok) return;
          const list = await r.json();
          filterList(list, term, ['name', 'email']).forEach((a: any) =>
            out.push({ type: 'admin', id: String(a.id), name: a.name, email: a.email }));
        }).catch(() => {}));
      }
      await Promise.all(tasks);
      setResults(out);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const onChange = (val: string) => {
    setQ(val);
    if (timer.current) clearTimeout(timer.current);
    if (!val.trim()) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(() => run(val), 250);
  };

  const onFilterChange = (f: SearchFilter) => {
    setFilter(f);
    if (timer.current) clearTimeout(timer.current);
  };

  // Re-run search when the active filter changes (keeps the query)
  useEffect(() => {
    if (q.trim()) run(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const submit = (e: React.FormEvent) => { e.preventDefault(); if (timer.current) clearTimeout(timer.current); run(q); };

  const go = (r: SearchResult) => {
    setOpen(false); setQ('');
    onNavigate(r.type === 'salon' ? 'salons' : r.type === 'admin' ? 'admins' : 'customers');
  };

  const filters: { value: SearchFilter; label: string }[] = [
    { value: 'all', label: t('common.all') },
    { value: 'salon', label: t('common.salons') },
    { value: 'customer', label: t('common.customers') },
    ...(isSuperAdmin ? [{ value: 'admin' as SearchFilter, label: t('common.admins') }] : []),
  ];

  return (
    <div className="relative" ref={ref}>
      <form onSubmit={submit} className="flex items-stretch">
        <select
          value={filter}
          onChange={(e) => onFilterChange(e.target.value as SearchFilter)}
          title="Search in"
          className="bg-slate-700/40 border border-slate-600/50 border-r-0 rounded-l-xl px-2 text-xs text-slate-200 outline-none focus:bg-slate-700/60 cursor-pointer"
        >
          {filters.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder={t('common.search')}
            className="w-44 sm:w-72 bg-slate-700/30 focus:bg-slate-700/50 border border-transparent focus:border-slate-600 rounded-r-xl pl-9 pr-8 py-2 text-white text-sm placeholder-slate-400 outline-none transition-all"
          />
          {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />}
        </div>
      </form>
      {open && results.length > 0 && (
        <div className="absolute right-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-1 z-50 max-h-80 overflow-y-auto">
          {results.map((r, i) => (
            <button key={`${r.type}-${r.id}-${i}`} type="button" onClick={() => go(r)}
              className="w-full text-left px-4 py-2.5 hover:bg-slate-700/50 transition-colors flex items-center gap-3">
              <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${r.type === 'salon' ? 'bg-indigo-500/15 text-indigo-300' : r.type === 'admin' ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>{r.type}</span>
              <span className="min-w-0">
                <span className="block text-sm text-white truncate">{r.name}</span>
                <span className="block text-xs text-slate-400 truncate">{r.phone || r.email || ''}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminLayout({ activePage, setActivePage }: { activePage: string; setActivePage: (page: string) => void }) {
  const { admin, logout, adminFetch } = useAdminAuth();
  const t = useT();
  const isSuperAdmin = admin?.role === 'super_admin';
  const navItems = isSuperAdmin ? superAdminNav : adminNav;
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Close mobile sidebar on page change
  useEffect(() => { setMobileOpen(false); }, [activePage]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const doDownload = async (url: string, filename: string) => {
    try {
      const res = await adminFetch(url);
      if (!res.ok) return;
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {}
  };

  const handleExport = (url: string, filename: string) => { doDownload(url, filename); setExportOpen(false); };
  const handleBackup = async () => { await doDownload('/api/admin/database/backup', `backup-${new Date().toISOString().split('T')[0]}.json`); setExportOpen(false); };
  const roleLabel = isSuperAdmin ? 'Super Admin' : admin?.role === 'admin' ? 'Admin' : admin?.role || 'Admin';

  const sidebarContent = (isOpen: boolean, onClose?: () => void) => (
    <>
      <div className={`p-4 flex items-center border-b border-slate-700/50 ${isOpen ? 'justify-between' : 'flex-col gap-3'}`}>
        <div className={`flex items-center ${isOpen ? 'gap-3' : 'flex-col gap-1'}`}>
          <div className={`${isOpen ? 'w-10 h-10' : 'w-9 h-9'} rounded-xl flex items-center justify-center shadow-lg shrink-0 ${isSuperAdmin ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/20' : 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-500/20'}`}>
            {isSuperAdmin ? <Crown className="w-5 h-5 text-white" /> : <Shield className="w-5 h-5 text-white" />}
          </div>
          {isOpen && (
            <div>
              <h1 className="text-lg font-bold tracking-tight">{isSuperAdmin ? 'Super' : 'Admin'} <span className={isSuperAdmin ? 'text-amber-400' : 'text-indigo-400'}>Panel</span></h1>
              <p className="text-[10px] text-slate-500">{isSuperAdmin ? 'Full Platform Access' : 'Platform Management'}</p>
            </div>
          )}
        </div>
        <button type="button" onClick={onClose || (() => setDesktopOpen(!desktopOpen))} className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-slate-700/50 transition-all">
          {isOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </div>
      {isSuperAdmin && isOpen && (
        <div className="mx-3 mb-2 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
          <div className="flex items-center gap-2"><Crown className="w-3.5 h-3.5 text-amber-400" /><span className="text-[11px] font-semibold text-amber-400">Super Administrator</span></div>
        </div>
      )}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto admin-sidebar-nav">
        {navItems.map((item) => (
          <button type="button" key={item.id} onClick={() => setActivePage(item.id)} title={!isOpen ? item.label : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm relative ${
              activePage === item.id
                ? isSuperAdmin ? 'bg-amber-500/15 text-amber-300 shadow-sm border border-amber-500/10' : 'bg-indigo-500/15 text-indigo-300 shadow-sm border border-indigo-500/10'
                : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
            } ${!isOpen ? 'justify-center px-2' : ''}`}>
            <item.icon className={`${isOpen ? 'w-4 h-4' : 'w-5 h-5'} shrink-0 ${activePage === item.id ? (isSuperAdmin ? 'text-amber-400' : 'text-indigo-400') : ''}`} />
            {isOpen && <span className="font-medium">{t(`nav.${item.id}`) || item.label}</span>}
            {activePage === item.id && <div className={`${isOpen ? 'ml-auto w-1.5 h-5' : 'absolute -left-0.5 w-1 h-5'} rounded-full ${isSuperAdmin ? 'bg-amber-400' : 'bg-indigo-400'}`} />}
          </button>
        ))}
      </nav>
      <div className="p-3 border-t border-slate-700/50">
        <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-700/30 ${!isOpen ? 'justify-center' : ''}`}>
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ring-2 shrink-0 ${isSuperAdmin ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white ring-amber-500/20' : 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white ring-indigo-500/20'}`}>
            {admin?.email?.charAt(0).toUpperCase() || 'A'}
          </div>
          {isOpen && (
            <div className="flex-1 overflow-hidden text-left min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">{admin?.email}</p>
              <p className={`text-[10px] uppercase tracking-wide font-medium ${isSuperAdmin ? 'text-amber-400' : 'text-indigo-400'}`}>{roleLabel}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-slate-900 text-white font-sans">
      {/* Desktop sidebar */}
      <aside className={`hidden md:flex ${desktopOpen ? 'w-64' : 'w-16'} bg-slate-800/80 backdrop-blur border-r border-slate-700/50 flex-col shrink-0 transition-all duration-300 group`}>
        {sidebarContent(desktopOpen)}
      </aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setMobileOpen(false)} />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-y-0 left-0 z-50 w-64 bg-slate-800/95 backdrop-blur-xl border-r border-slate-700/50 flex flex-col md:hidden">
              {sidebarContent(true, () => setMobileOpen(false))}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 md:h-16 bg-slate-800/60 backdrop-blur border-b border-slate-700/50 flex items-center justify-between px-4 md:px-8 shrink-0">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setMobileOpen(true)} className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50">
              <Menu className="w-5 h-5" />
            </button>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isSuperAdmin ? 'bg-amber-500/20' : 'bg-indigo-500/20'}`}>
              {isSuperAdmin ? <Crown className="w-4 h-4 text-amber-400" /> : <Activity className="w-4 h-4 text-indigo-400" />}
            </div>
            <ChevronRight className="w-3 h-3 text-slate-600 hidden sm:block" />
            <span className="text-sm font-medium text-slate-200 capitalize">{t(`nav.${activePage}`) || activePage}</span>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <GlobalSearch adminFetch={adminFetch} onNavigate={setActivePage} isSuperAdmin={isSuperAdmin} />
            <ThemeToggle />
            <LanguageToggle />
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700/30">
              <div className={`w-2 h-2 rounded-full ${isSuperAdmin ? 'bg-amber-400' : 'bg-indigo-400'} animate-pulse`} />
              <span className={`text-[11px] font-semibold ${isSuperAdmin ? 'text-amber-400' : 'text-indigo-400'}`}>{roleLabel}</span>
            </div>
            <div className="relative" ref={exportRef}>
              <button type="button" onClick={() => setExportOpen(!exportOpen)} className="flex items-center gap-2 px-3 md:px-4 py-2 bg-slate-700/30 hover:bg-slate-600/40 text-slate-300 hover:text-white rounded-xl transition-all text-sm font-semibold">
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">{t('common.export')}</span>
              </button>
              {exportOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-1 z-50">
                  <button type="button" onClick={() => handleExport('/api/export/appointments/csv', 'appointments.csv')} className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors">Export Appointments (CSV)</button>
                  <button type="button" onClick={() => handleExport('/api/export/customers/csv', 'customers.csv')} className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors">Export Customers (CSV)</button>
                  <button type="button" onClick={() => handleExport('/api/export/finances/csv', 'finances.csv')} className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors">Export Finances (CSV)</button>
                  <div className="border-t border-slate-700/50 my-1" />
                  <button type="button" onClick={handleBackup} className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors">Database Backup</button>
                </div>
              )}
            </div>
            <button type="button" onClick={logout} className="flex items-center gap-2 px-3 md:px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-xl transition-all text-sm font-semibold">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{t('common.signOut')}</span>
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div key={activePage} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>}>
                {activePage === 'dashboard' && <AdminDashboard isSuperAdmin={isSuperAdmin} />}
                {activePage === 'inbox' && <AdminInbox />}
                {activePage === 'locations' && <AdminLocations />}
                {activePage === 'salons' && <AdminSalons />}
                {isSuperAdmin && activePage === 'qr' && <AdminLiveQR />}
                {isSuperAdmin && activePage === 'sessions' && <AdminWhatsApp />}
                {activePage === 'appointments' && <AdminAppointments />}
                {activePage === 'customers' && <AdminCustomers />}
                {activePage === 'crm' && <AdminCRM />}
                {activePage === 'calendar' && <AdminCalendar />}
                {activePage === 'finances' && <AdminFinances />}
                {activePage === 'inventory' && <AdminInventory />}
                {isSuperAdmin && activePage === 'admins' && <AdminManage />}
                {activePage === 'settings' && <AdminSettings />}
                {activePage === 'audit' && <AdminAudit />}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
