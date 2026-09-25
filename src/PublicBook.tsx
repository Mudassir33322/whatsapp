import React from 'react';
import { Scissors } from 'lucide-react';
import { BookingWizard } from './components/BookingWizard';

export default function PublicBook() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <header className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-center px-4 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
            <Scissors className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold text-sm">Book Appointment</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="p-4 max-w-lg mx-auto space-y-6">
          <BookingWizard variant="public" />
        </div>
      </main>
    </div>
  );
}
