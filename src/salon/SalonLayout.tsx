import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useSalonAuth } from './SalonAuthContext';
import {
  LayoutDashboard, Users, Scissors, Calendar,
  Percent, Star, UserCircle, BarChart3, Settings, LogOut,
  ChevronRight, Menu, X, Store, ArmchairIcon as Chair, Package, DollarSign,
  Image, UserPlus, AlertTriangle, Fingerprint, Sparkles, CalendarDays,
  Bell, Loader2, Sun, Moon
} from 'lucide-react';
import { ThemeProvider, useTheme } from '../components/ThemeContext';

const SalonDashboard = lazy(() => import('./SalonDashboard').then(m => ({ default: m.SalonDashboard })));
const SalonBarbers = lazy(() => import('./SalonBarbers').then(m => ({ default: m.SalonBarbers })));
const SalonServices = lazy(() => import('./SalonServices').then(m => ({ default: m.SalonServices })));
const SalonSeats = lazy(() => import('./SalonSeats').then(m => ({ default: m.SalonSeats })));
const SalonInventory = lazy(() => import('./SalonInventory').then(m => ({ default: m.SalonInventory })));
const SalonAppointments = lazy(() => import('./SalonAppointments').then(m => ({ default: m.SalonAppointments })));
const SalonOffers = lazy(() => import('./SalonOffers').then(m => ({ default: m.SalonOffers })));
const SalonReviews = lazy(() => import('./SalonReviews').then(m => ({ default: m.SalonReviews })));
const SalonCustomers = lazy(() => import('./SalonCustomers').then(m => ({ default: m.SalonCustomers })));
const SalonWalkin = lazy(() => import('./SalonWalkin').then(m => ({ default: m.SalonWalkin })));
const SalonGallery = lazy(() => import('./SalonGallery').then(m => ({ default: m.SalonGallery })));
const SalonStockAlerts = lazy(() => import('./SalonStockAlerts').then(m => ({ default: m.SalonStockAlerts })));
const SalonAttendance = lazy(() => import('./SalonAttendance').then(m => ({ default: m.SalonAttendance })));
const SalonFinances = lazy(() => import('./SalonFinances').then(m => ({ default: m.SalonFinances })));
const SalonAnalytics = lazy(() => import('./SalonAnalytics').then(m => ({ default: m.SalonAnalytics })));
const SalonSettings = lazy(() => import('./SalonSettings').then(m => ({ default: m.SalonSettings })));
const SalonCalendar = lazy(() => import('./SalonCalendar').then(m => ({ default: m.SalonCalendar })));
const SalonDayOffs = lazy(() => import('./SalonDayOffs').then(m => ({ default: m.SalonDayOffs })));
const SalonNotifications = lazy(() => import('./SalonNotifications').then(m => ({ default: m.SalonNotifications })));

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button type="button" onClick={toggle} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
      className="p-2 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 hover:bg-amber-100 transition-colors shrink-0">
      {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

export function SalonLayout() {
  const { salon, logout } = useSalonAuth();
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const activePage = location.pathname.startsWith('/salon/')
    ? location.pathname.replace('/salon/', '') || 'dashboard'
    : 'dashboard';

  // Close mobile sidebar on page change
  useEffect(() => { setMobileOpen(false); }, [activePage]);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'appointments', label: 'Appointments', icon: Calendar },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
    { id: 'dayoffs', label: 'Day Offs', icon: CalendarDays },
    { id: 'barbers', label: 'Barbers', icon: Users },
    { id: 'services', label: 'Services', icon: Scissors },
    { id: 'customers', label: 'Customers', icon: UserCircle },
    { id: 'walkin', label: 'Walk-in', icon: UserPlus },
    { id: 'finances', label: 'Finances', icon: DollarSign },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'stock', label: 'Stock Alerts', icon: AlertTriangle },
    { id: 'seats', label: 'Seats', icon: Chair },
    { id: 'attendance', label: 'Attendance', icon: Fingerprint },
    { id: 'offers', label: 'Offers', icon: Percent },
    { id: 'reviews', label: 'Reviews', icon: Star },
    { id: 'gallery', label: 'Gallery', icon: Image },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const sidebarContent = (isOpen: boolean, onClose?: () => void) => (
    <>
      <div className={`p-4 flex items-center border-b border-amber-100 ${isOpen ? 'justify-between' : 'flex-col gap-3'}`}>
        {isOpen ? (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center shadow-sm">
              <Store className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-800 truncate">{salon?.name || 'Salon'}</div>
              <div className="text-[10px] text-amber-600 font-medium">Salon Portal</div>
            </div>
          </div>
        ) : (
          <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center shadow-sm">
            <Store className="w-4 h-4 text-white" />
          </div>
        )}
        <button type="button" onClick={onClose || (() => setDesktopOpen(!desktopOpen))} className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 transition-all">
          {isOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(item => (
          <button type="button" key={item.id} onClick={() => navigate(`/salon/${item.id}`)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm ${
              activePage === item.id
                ? 'bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 font-semibold shadow-sm border border-amber-200/50'
                : 'text-slate-500 hover:bg-amber-50/50 hover:text-slate-700'
            } ${!isOpen ? 'justify-center px-2' : ''}`}
            title={!isOpen ? item.label : undefined}>
            <item.icon className={`w-5 h-5 shrink-0 ${activePage === item.id ? 'text-amber-600' : ''}`} />
            {isOpen && <span>{item.label}</span>}
          </button>
        ))}
      </nav>
      <div className="p-3 border-t border-amber-100">
        <button type="button" onClick={logout} className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-rose-600 hover:bg-rose-50 rounded-xl transition-all ${!isOpen ? 'justify-center' : ''}`}>
          <LogOut className="w-5 h-5" />
          {isOpen && <span>Sign Out</span>}
        </button>
      </div>
    </>
  );

  return (
    <ThemeProvider>
    <div className="flex h-screen bg-gradient-to-br from-stone-50 to-amber-50/30">
      {/* Desktop sidebar */}
      <aside className={`hidden md:flex ${desktopOpen ? 'w-64' : 'w-16'} bg-white/90 backdrop-blur-xl border-r border-amber-100 flex-col transition-all duration-300 shadow-sm`}>
        {sidebarContent(desktopOpen)}
      </aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setMobileOpen(false)} />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-y-0 left-0 z-50 w-64 bg-white/95 backdrop-blur-xl border-r border-amber-100 flex flex-col md:hidden shadow-2xl">
              {sidebarContent(true, () => setMobileOpen(false))}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="h-14 md:h-16 bg-white/80 backdrop-blur-xl border-b border-amber-100 flex items-center justify-between px-4 md:px-6 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <button type="button" onClick={() => setMobileOpen(true)} className="md:hidden p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50">
              <Menu className="w-5 h-5" />
            </button>
            <div className="w-6 h-6 bg-gradient-to-br from-amber-500 to-orange-500 rounded-md flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <ChevronRight className="w-3 h-3 hidden sm:block" />
            <span className="text-slate-700 font-medium capitalize">{activePage}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <ThemeToggle />
            <div className="flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100">
              <div className="w-6 h-6 bg-gradient-to-br from-amber-500 to-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                {salon?.name?.charAt(0) || 'S'}
              </div>
              <span className="text-slate-700 font-medium hidden sm:block">{salon?.name}</span>
            </div>
          </div>
        </header>

        <div className="p-4 md:p-6">
          <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-amber-600" /></div>}>
            {(() => {
              const Page = {
                dashboard: SalonDashboard,
                barbers: SalonBarbers,
                services: SalonServices,
                seats: SalonSeats,
                inventory: SalonInventory,
                appointments: SalonAppointments,
                calendar: SalonCalendar,
                dayoffs: SalonDayOffs,
                offers: SalonOffers,
                reviews: SalonReviews,
                customers: SalonCustomers,
                walkin: SalonWalkin,
                gallery: SalonGallery,
                stock: SalonStockAlerts,
                attendance: SalonAttendance,
                finances: SalonFinances,
                analytics: SalonAnalytics,
                notifications: SalonNotifications,
                settings: SalonSettings,
              }[activePage] || SalonDashboard;
              return <Page />;
            })()}
          </Suspense>
        </div>
        </main>
      </div>
    </ThemeProvider>
  );
}
