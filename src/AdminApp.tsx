import React, { useState } from 'react';
import { AdminAuthProvider, useAdminAuth } from './admin/AdminAuthContext';
import { AdminLogin } from './admin/AdminLogin';
import { AdminLayout } from './admin/AdminLayout';
import { Loader2 } from 'lucide-react';

function AdminContent() {
  const { admin, loading } = useAdminAuth();
  const [activePage, setActivePage] = useState('dashboard');

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
    <AdminAuthProvider>
      <AdminContent />
    </AdminAuthProvider>
  );
}
