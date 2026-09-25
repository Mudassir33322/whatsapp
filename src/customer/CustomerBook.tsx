import React from 'react';
import { BookingWizard } from '../components/BookingWizard';
import { useCustomerAuth } from './CustomerAuthContext';

export function CustomerBook() {
  const { token } = useCustomerAuth();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Book Appointment</h1>
      <BookingWizard token={token} variant="customer" />
    </div>
  );
}
