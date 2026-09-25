import React from 'react';
import { useCustomerAuth } from './CustomerAuthContext';
import { Home, CalendarDays, UserCircle, LogOut, MessageSquare, PlusCircle, Sun, Moon } from 'lucide-react';
import { CustomerDashboard } from './CustomerDashboard';
import { CustomerAppointments } from './CustomerAppointments';
import { CustomerProfile } from './CustomerProfile';
import { CustomerBook } from './CustomerBook';
import { ThemeProvider, useTheme } from '../components/ThemeContext';

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button type="button" onClick={toggle} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
      className="p-2 text-slate-400 hover:text-indigo-400 transition-colors" aria-label="Toggle theme">
      {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}

interface CustomerLayoutProps {
  activePage: string;
  setActivePage: (page: string) => void;
}

export function CustomerLayout({ activePage, setActivePage }: CustomerLayoutProps) {
  const { customer, logout } = useCustomerAuth();

  if (!customer) return null;

  const navItems = [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'book', label: 'Book', icon: PlusCircle },
    { id: 'appointments', label: 'Appointments', icon: CalendarDays },
    { id: 'profile', label: 'Profile', icon: UserCircle },
  ];

  return (
    <ThemeProvider>
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <header className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold text-sm">My Salon</span>
        </div>
        <button type="button"
          onClick={logout}
          className="p-2 text-slate-400 hover:text-rose-400 transition-colors"
          title="Sign Out"
        >
          <LogOut className="w-5 h-5" />
        </button>
        <ThemeToggle />
      </header>

      <main className="flex-1 overflow-y-auto pb-16">
        <div className="p-4">
          {activePage === 'dashboard' && <CustomerDashboard />}
          {activePage === 'book' && <CustomerBook />}
          {activePage === 'appointments' && <CustomerAppointments />}
          {activePage === 'profile' && <CustomerProfile />}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 z-10">
        <div className="flex items-center justify-around h-16">
          {navItems.map(item => (
            <button type="button"
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors ${
                activePage === item.id
                  ? 'text-indigo-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
    </ThemeProvider>
  );
}
