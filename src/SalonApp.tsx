import React from 'react';
import { SalonAuthProvider, useSalonAuth } from './salon/SalonAuthContext';
import { SalonLogin } from './salon/SalonLogin';
import { SalonLayout } from './salon/SalonLayout';
import { Loader2 } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';

function SalonContent() {
  const { salon, loading } = useSalonAuth();

  if (loading) {
    return (
      <div className="h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!salon) return <SalonLogin />;

  return <SalonLayout />;
}

export default function SalonApp() {
  return (
    <ErrorBoundary>
      <SalonAuthProvider>
        <SalonContent />
      </SalonAuthProvider>
    </ErrorBoundary>
  );
}
