import React, { useState, useEffect } from 'react';
import { AdminAuthProvider, useAdminAuth } from './admin/AdminAuthContext';
import { AdminLogin } from './admin/AdminLogin';
import { AdminLayout } from './admin/AdminLayout';
import { Loader2 } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { I18nProvider } from './i18n';
import { ThemeProvider } from './components/ThemeContext';
import { SocketProvider } from './context/SocketContext';

const LS_KEY = 'admin-active-page';

function AdminContent() {
  const { admin, loading } = useAdminAuth();
  const [activePage, setActivePage] = useState(() => localStorage.getItem(LS_KEY) || 'dashboard');

  useEffect(() => {
    localStorage.setItem(LS_KEY, activePage);
  }, [activePage]);

  if (loading) {
    return (
      <div className="h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!admin) return <AdminLogin />;

  return <AdminLayout activePage={activePage} setActivePage={setActivePage} />;
}

export default function AdminApp() {
  return (
    <ErrorBoundary>
      <AdminAuthProvider>
        <I18nProvider>
          <SocketProvider>
            <ThemeProvider>
              <AdminContent />
            </ThemeProvider>
          </SocketProvider>
        </I18nProvider>
      </AdminAuthProvider>
    </ErrorBoundary>
  );
}
