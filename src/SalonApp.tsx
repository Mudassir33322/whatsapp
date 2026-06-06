import React, { useState } from 'react';
import { SalonAuthProvider, useSalonAuth } from './salon/SalonAuthContext';
import { SalonLogin } from './salon/SalonLogin';
import { SalonLayout } from './salon/SalonLayout';
import { Loader2 } from 'lucide-react';

function SalonContent() {
  const { salon, loading } = useSalonAuth();
  const [activePage, setActivePage] = useState('dashboard');

  if (loading) {
    return (
      <div className="h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!salon) return <SalonLogin />;

  return <SalonLayout activePage={activePage} setActivePage={setActivePage} />;
}

export default function SalonApp() {
  return (
    <SalonAuthProvider>
      <SalonContent />
    </SalonAuthProvider>
  );
}
