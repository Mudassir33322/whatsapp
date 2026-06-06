import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutDashboard, MapPin, Store, Calendar, UserCircle, DollarSign, Package, Bot, LogOut, Shield, ChevronRight, Users, QrCode, Smartphone } from 'lucide-react';
import { useAdminAuth } from './AdminAuthContext';
import { AdminDashboard } from './AdminDashboard';
import { AdminLocations } from './AdminLocations';
import { AdminSalons } from './AdminSalons';

import { AdminAppointments } from './AdminAppointments';
import { AdminCustomers } from './AdminCustomers';
import { AdminFinances } from './AdminFinances';
import { AdminInventory } from './AdminInventory';
import { AdminAutomations } from './AdminAutomations';
import { AdminManage } from './AdminManage';
import { AdminLiveQR } from './AdminLiveQR';
import { AdminWhatsApp } from './AdminWhatsApp';

const superAdminNav = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'locations', label: 'Locations', icon: MapPin },
  { id: 'salons', label: 'Salons', icon: Store },
  { id: 'qr', label: 'Live QR', icon: QrCode },
  { id: 'sessions', label: 'Sessions', icon: Smartphone },

  { id: 'appointments', label: 'Appointments', icon: Calendar },
  { id: 'customers', label: 'Customers', icon: UserCircle },
  { id: 'finances', label: 'Finances', icon: DollarSign },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'automations', label: 'Automations', icon: Bot },
  { id: 'admins', label: 'Admins', icon: Users },
];

const adminNav = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'locations', label: 'Locations', icon: MapPin },
  { id: 'salons', label: 'Salons', icon: Store },
  { id: 'appointments', label: 'Appointments', icon: Calendar },
  { id: 'customers', label: 'Customers', icon: UserCircle },
  { id: 'finances', label: 'Finances', icon: DollarSign },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'automations', label: 'Automations', icon: Bot },
];

export function AdminLayout({ activePage, setActivePage }: { activePage: string; setActivePage: (page: string) => void }) {
  const { admin, logout } = useAdminAuth();
  const isSuperAdmin = admin?.role === 'super_admin';
  const navItems = isSuperAdmin ? superAdminNav : adminNav;

  const roleLabel = isSuperAdmin ? 'Super Admin' : admin?.role === 'admin' ? 'Admin' : admin?.role || 'Admin';

  return (
    <div className="flex h-screen bg-slate-900 text-white font-sans">
      <aside className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col shrink-0">
        <div className="p-6 flex items-center gap-3">
          <div className={`w-10 h-10 ${isSuperAdmin ? 'bg-amber-500' : 'bg-indigo-600'} rounded-xl flex items-center justify-center`}>
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Admin <span className="text-indigo-400">Panel</span></h1>
        </div>
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                activePage === item.id
                  ? 'bg-indigo-600/30 text-indigo-400 shadow-sm'
                  : 'text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium text-sm">{item.label}</span>
              {activePage === item.id && (
                <motion.div layoutId="admin-nav-pill" className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500" />
              )}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-700">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ring-2 ${isSuperAdmin ? 'bg-amber-500 ring-amber-500/20' : 'bg-indigo-500 ring-indigo-500/20'}`}>
              {admin?.email?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="flex-1 overflow-hidden text-left min-w-0">
              <p className="text-xs font-semibold truncate">{admin?.email}</p>
              <p className={`text-[10px] uppercase tracking-wide ${isSuperAdmin ? 'text-amber-400' : 'text-slate-400'}`}>{roleLabel}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-2 text-slate-400">
            <Shield className="w-4 h-4" />
            <ChevronRight className="w-4 h-4" />
            <span className="text-sm font-medium text-white capitalize">{activePage}</span>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-xl transition-colors text-sm font-semibold"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activePage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activePage === 'dashboard' && <AdminDashboard />}
              {activePage === 'locations' && <AdminLocations />}
              {activePage === 'salons' && <AdminSalons />}
              {isSuperAdmin && activePage === 'qr' && <AdminLiveQR />}
              {isSuperAdmin && activePage === 'sessions' && <AdminWhatsApp />}
              {activePage === 'appointments' && <AdminAppointments />}
              {activePage === 'customers' && <AdminCustomers />}
              {activePage === 'finances' && <AdminFinances />}
              {activePage === 'inventory' && <AdminInventory />}
              {activePage === 'automations' && <AdminAutomations />}
              {isSuperAdmin && activePage === 'admins' && <AdminManage />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
