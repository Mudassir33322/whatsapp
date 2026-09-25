import React, { useState, useEffect } from 'react';
import { CustomerAuthProvider, useCustomerAuth } from './CustomerAuthContext';
import { CustomerLogin } from './CustomerLogin';
import { CustomerLayout } from './CustomerLayout';
import { Loader2 } from 'lucide-react';
import { ErrorBoundary } from '../components/ErrorBoundary';

const LS_KEY = 'customer-active-page';

function CustomerContent() {
  const { customer, loading } = useCustomerAuth();
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

  if (!customer) return <CustomerLogin />;

  return <CustomerLayout activePage={activePage} setActivePage={setActivePage} />;
}

export default function CustomerApp() {
  return (
    <ErrorBoundary>
      <CustomerAuthProvider>
        <CustomerContent />
      </CustomerAuthProvider>
    </ErrorBoundary>
  );
}
