import React, { useState } from 'react';
import { useSalonAuth } from './SalonAuthContext';
import {
  LayoutDashboard, Users, Scissors, Calendar, 
  Percent, Star, UserCircle, BarChart3, Settings, LogOut,
  ChevronRight, Menu, X, Store, ArmchairIcon as Chair, Package, DollarSign,
  Image, UserPlus, AlertTriangle, Fingerprint
} from 'lucide-react';

interface PageProps {
  activePage: string;
  setActivePage: (page: string) => void;
}

export function SalonLayout({ activePage, setActivePage }: PageProps) {
  const { salon, logout } = useSalonAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'barbers', label: 'Barbers', icon: Users },
    { id: 'services', label: 'Services', icon: Scissors },
    { id: 'seats', label: 'Seats', icon: Chair },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'appointments', label: 'Appointments', icon: Calendar },
    { id: 'offers', label: 'Offers', icon: Percent },
    { id: 'reviews', label: 'Reviews', icon: Star },
    { id: 'customers', label: 'Customers', icon: UserCircle },
    { id: 'walkin', label: 'Walk-in', icon: UserPlus },
    { id: 'gallery', label: 'Gallery', icon: Image },
    { id: 'stock', label: 'Stock Alerts', icon: AlertTriangle },
    { id: 'attendance', label: 'Attendance', icon: Fingerprint },
    { id: 'finances', label: 'Finances', icon: DollarSign },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-white border-r border-slate-200 flex flex-col transition-all duration-300`}>
        <div className="p-4 flex items-center justify-between border-b border-slate-100">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <Store className="w-4 h-4 text-white" />
              </div>
              <div className="text-sm font-bold truncate">{salon?.name || 'Salon'}</div>
            </div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm ${
                activePage === item.id
                  ? 'bg-indigo-50 text-indigo-700 font-semibold'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
              title={!sidebarOpen ? item.label : undefined}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-100">
          <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Store className="w-4 h-4" />
            <ChevronRight className="w-3 h-3" />
            <span className="text-slate-700 font-medium capitalize">{activePage}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">
              {salon?.name?.charAt(0) || 'S'}
            </div>
            <span className="hidden sm:block">{salon?.name}</span>
          </div>
        </header>

        <div className="p-6">
          {activePage === 'dashboard' && <SalonDashboard />}
          {activePage === 'barbers' && <SalonBarbers />}
          {activePage === 'services' && <SalonServices />}
          {activePage === 'seats' && <SalonSeats />}
          {activePage === 'inventory' && <SalonInventory />}
          {activePage === 'appointments' && <SalonAppointments />}
          {activePage === 'offers' && <SalonOffers />}
          {activePage === 'reviews' && <SalonReviews />}
          {activePage === 'customers' && <SalonCustomers />}
          {activePage === 'walkin' && <SalonWalkin />}
          {activePage === 'gallery' && <SalonGallery />}
          {activePage === 'stock' && <SalonStockAlerts />}
          {activePage === 'attendance' && <SalonAttendance />}
          {activePage === 'finances' && <SalonFinances />}
          {activePage === 'analytics' && <SalonAnalytics />}
          {activePage === 'settings' && <SalonSettings />}
        </div>
      </main>
    </div>
  );
}

// Lazy import wrappers - pages will be below
import { SalonDashboard } from './SalonDashboard';
import { SalonBarbers } from './SalonBarbers';
import { SalonServices } from './SalonServices';
import { SalonSeats } from './SalonSeats';
import { SalonInventory } from './SalonInventory';
import { SalonAppointments } from './SalonAppointments';
import { SalonOffers } from './SalonOffers';
import { SalonReviews } from './SalonReviews';
import { SalonCustomers } from './SalonCustomers';
import { SalonWalkin } from './SalonWalkin';
import { SalonGallery } from './SalonGallery';
import { SalonStockAlerts } from './SalonStockAlerts';
import { SalonAttendance } from './SalonAttendance';
import { SalonFinances } from './SalonFinances';
import { SalonAnalytics } from './SalonAnalytics';
import { SalonSettings } from './SalonSettings';
