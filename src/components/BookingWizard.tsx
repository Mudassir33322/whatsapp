import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Store, Scissors, User, Clock, CheckCircle, Phone, ArrowLeft, Loader2 } from 'lucide-react';
import { API_URL } from '../config';
import { EmptyState } from './EmptyState';

interface Salon {
  id: number; name: string; phone: string; address: string;
  rating: number; review_count: number;
  city_name?: string; area_name?: string; country_name?: string;
}
interface Location { id: number; name: string; }
interface Service { id: number; name: string; description: string; price: number; duration: number; category: string; }
interface Barber { id: number; name: string; rating: number; review_count: number; experience: number; specialization: string; }
interface TimeSlot { start: string; end: string; }

interface BookingResult {
  token: string; salon_name: string; service_name: string; barber_name: string;
  appointment_date: string; appointment_time: string;
}

const stepDefs = [
  { id: 1, label: 'Salon', icon: Store },
  { id: 2, label: 'Service', icon: Scissors },
  { id: 3, label: 'Barber', icon: User },
  { id: 4, label: 'Time', icon: Clock },
  { id: 5, label: 'Done', icon: CheckCircle },
];

interface BookingWizardProps {
  token?: string | null;
  variant?: 'public' | 'customer';
  onBookingComplete?: (booking: BookingResult) => void;
}

export const BookingWizard = React.memo(function BookingWizard({ token, variant = 'public', onBookingComplete }: BookingWizardProps) {
  const [step, setStep] = useState(1);
  const [salons, setSalons] = useState<Salon[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null);
  const [bookingError, setBookingError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const [selectedSalon, setSelectedSalon] = useState<Salon | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  const [countries, setCountries] = useState<Location[]>([]);
  const [cities, setCities] = useState<Location[]>([]);
  const [areas, setAreas] = useState<Location[]>([]);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedArea, setSelectedArea] = useState('');

  const headers: Record<string, string> = token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };

  const fetchAuth = useCallback(async (url: string, init?: RequestInit) => {
    const ac = new AbortController();
    try {
      const res = await fetch(API_URL + url, { ...init, headers, signal: ac.signal });
      return res;
    } finally { /* cleanup handled by caller */ }
  }, [token]);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/customer/locations`, { signal: ac.signal });
        if (res.ok) { const d = await res.json(); setCountries(d.countries || []); }
      } catch (e) { if (e instanceof DOMException && e.name === 'AbortError') return; }
    })();
    return () => ac.abort();
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    if (!selectedCountry) { setCities([]); setSelectedCity(''); return () => ac.abort(); }
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/customer/locations?country_id=${selectedCountry}`, { signal: ac.signal });
        if (res.ok) { const d = await res.json(); setCities(d.cities || []); }
      } catch (e) { if (e instanceof DOMException && e.name === 'AbortError') return; }
    })();
    return () => ac.abort();
  }, [selectedCountry]);

  useEffect(() => {
    const ac = new AbortController();
    if (!selectedCity) { setAreas([]); setSelectedArea(''); return () => ac.abort(); }
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/customer/locations?city_id=${selectedCity}`, { signal: ac.signal });
        if (res.ok) { const d = await res.json(); setAreas(d.areas || []); }
      } catch (e) { if (e instanceof DOMException && e.name === 'AbortError') return; }
    })();
    return () => ac.abort();
  }, [selectedCity]);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedArea) params.set('area_id', selectedArea);
        else if (selectedCity) params.set('city_id', selectedCity);
        else if (selectedCountry) params.set('country_id', selectedCountry);
        const qs = params.toString();
        const res = await fetch(`${API_URL}/api/customer/bookable-salons${qs ? '?' + qs : ''}`, { signal: ac.signal });
        if (res.ok) setSalons(await res.json());
      } catch (e) { if (e instanceof DOMException && e.name === 'AbortError') return; }
      setLoading(false);
    })();
    return () => ac.abort();
  }, [selectedCountry, selectedCity, selectedArea]);

  const selectSalon = useCallback(async (salon: Salon) => {
    setSelectedSalon(salon);
    setSelectedService(null); setSelectedBarber(null); setSelectedDate(''); setSelectedSlot(null);
    setLoadError(''); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/customer/bookable-salons/${salon.id}/services`);
      if (res.ok) { const d = await res.json(); setServices(d.services || []); setBarbers(d.barbers || []); }
    } catch (e) { setLoadError('Failed to load salon data. Please try again.'); }
    setLoading(false); setStep(2);
  }, []);

  const loadSlots = useCallback(async (date: string) => {
    if (!selectedBarber || !selectedSalon || !date) return;
    setSelectedDate(date); setSelectedSlot(null); setLoadError(''); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/customer/bookable-salons/${selectedSalon.id}/slots?date=${date}&barber_id=${selectedBarber.id}`);
      if (res.ok) { const d = await res.json(); setSlots(d.slots || []); }
    } catch (e) { setLoadError('Failed to load time slots. Please try again.'); }
    setLoading(false);
  }, [selectedBarber, selectedSalon]);

  const confirmBooking = useCallback(async () => {
    if (!selectedSalon || !selectedService || !selectedBarber || !selectedDate || !selectedSlot) return;
    if (variant === 'public' && !/^\+?\d{10,15}$/.test(phone)) { setPhoneError('Please enter a valid phone number'); return; }
    setPhoneError(''); setLoading(true);
    try {
      const body: Record<string, unknown> = {
        salon_id: selectedSalon.id, service_id: selectedService.id,
        barber_id: selectedBarber.id, appointment_date: selectedDate,
        appointment_time: selectedSlot.start,
      };
      if (variant === 'public') body.phone = phone;
      const url = variant === 'public' ? '/api/customer/bookings/public' : '/api/customer/bookings';
      const res = await fetch(API_URL + url, { method: 'POST', headers, body: JSON.stringify(body) });
      if (res.ok) {
        const data = await res.json(); setBookingResult(data); setStep(5);
        onBookingComplete?.(data);
      } else {
        const err = await res.json().catch(() => ({ error: 'Booking failed. Try again.' }));
        alert(err.error || 'Booking could not be completed.');
      }
    } catch (e) { console.error('[BookingWizard] Booking failed:', e); setBookingError('Network error. Could not complete booking.'); }
    setLoading(false);
  }, [selectedSalon, selectedService, selectedBarber, selectedDate, selectedSlot, phone, variant, headers, onBookingComplete]);

  const reset = useCallback(() => {
    setStep(1); setSelectedSalon(null); setSelectedService(null);
    setSelectedBarber(null); setSelectedDate(''); setSelectedSlot(null);
    setSlots([]); setBookingResult(null); setPhone('');
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-rose-300 text-sm text-center">{loadError}</div>
      )}
      {step > 1 && step < 5 && (
        <button type="button" onClick={() => setStep(s => s - 1)} className="text-slate-400 hover:text-white flex items-center gap-1 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      )}

      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {stepDefs.map((s, i) => (
          <React.Fragment key={s.id}>
            <div className={`flex items-center gap-1.5 shrink-0 ${step === s.id ? 'text-indigo-400' : step > s.id ? 'text-emerald-400' : 'text-slate-600'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${step === s.id ? 'border-indigo-400 bg-indigo-500/20' : step > s.id ? 'border-emerald-400 bg-emerald-500/20' : 'border-slate-600'}`}>
                {step > s.id ? <CheckCircle className="w-4 h-4" /> : s.id}
              </div>
              <span className="text-[10px] font-medium hidden sm:inline">{s.label}</span>
            </div>
            {i < stepDefs.length - 1 && <div className="h-px flex-1 bg-slate-700 min-w-4" />}
          </React.Fragment>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Select Location & Salon</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select value={selectedCountry} onChange={e => { setSelectedCountry(e.target.value); setSelectedCity(''); setSelectedArea(''); }}
                className="bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500">
                <option value="" className="text-slate-800">Country</option>
                {countries.map(c => <option key={c.id} value={c.id} className="text-slate-800">{c.name}</option>)}
              </select>
              <select value={selectedCity} onChange={e => { setSelectedCity(e.target.value); setSelectedArea(''); }}
                disabled={!selectedCountry}
                className="bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-40">
                <option value="" className="text-slate-800">City</option>
                {cities.map(c => <option key={c.id} value={c.id} className="text-slate-800">{c.name}</option>)}
              </select>
              <select value={selectedArea} onChange={e => setSelectedArea(e.target.value)}
                disabled={!selectedCity}
                className="bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-40">
                <option value="" className="text-slate-800">Area</option>
                {areas.map(a => <option key={a.id} value={a.id} className="text-slate-800">{a.name}</option>)}
              </select>
            </div>
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>
            ) : salons.length === 0 ? (
              <div className="px-6 py-8"><EmptyState icon={Store} title="No salons found" description="Try adjusting your search or filters" /></div>
            ) : (
              salons.map(salon => (
                <button type="button" key={salon.id} onClick={() => selectSalon(salon)}
                  className="w-full text-left bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4 hover:bg-white/20 transition-colors flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shrink-0">
                    <Store className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold truncate">{salon.name}</div>
                    {salon.address && <div className="text-slate-400 text-xs truncate">{salon.address}</div>}
                    <div className="flex gap-2 text-[10px] text-slate-500 mt-0.5">
                      {salon.country_name && <span>{salon.country_name}</span>}
                      {salon.city_name && <span>&rsaquo; {salon.city_name}</span>}
                      {salon.area_name && <span>&rsaquo; {salon.area_name}</span>}
                    </div>
                    {salon.rating > 0 && <div className="text-amber-400 text-xs">{'★'.repeat(Math.round(salon.rating))} {salon.rating}</div>}
                  </div>
                </button>
              ))
            )}
          </motion.div>
        )}

        {step === 2 && selectedSalon && (
          <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Select Service</h2>
            <p className="text-slate-400 text-sm">{selectedSalon.name}</p>
            {services.map(service => (
              <button type="button" key={service.id} onClick={() => { setSelectedService(service); setStep(3); }}
                className="w-full text-left bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4 hover:bg-white/20 transition-colors flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center shrink-0">
                  <Scissors className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-semibold">{service.name}</div>
                  {service.description && <div className="text-slate-400 text-xs truncate">{service.description}</div>}
                  <div className="flex gap-3 mt-1">
                    <span className="text-indigo-400 text-sm font-medium">{'\u20B9'}{service.price}</span>
                    <span className="text-slate-400 text-sm">{service.duration} min</span>
                  </div>
                </div>
              </button>
            ))}
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Select Barber & Date</h2>
            <div className="space-y-2">
              {barbers.map(barber => (
                <button type="button" key={barber.id} onClick={() => { setSelectedBarber(barber); setSelectedSlot(null); setStep(4); }}
                  className={`w-full text-left bg-white/10 backdrop-blur-xl border rounded-2xl p-4 transition-colors flex items-center gap-4 ${selectedBarber?.id === barber.id ? 'border-indigo-500 bg-indigo-500/20' : 'border-white/20 hover:bg-white/20'}`}>
                  <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center shrink-0">
                    <User className="w-6 h-6 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold">{barber.name}</div>
                    {barber.specialization && <div className="text-slate-400 text-xs">{barber.specialization}</div>}
                    <div className="flex gap-2 mt-1 text-xs text-slate-400">
                      {barber.experience > 0 && <span>{barber.experience} years</span>}
                      {barber.rating > 0 && <span className="text-amber-400">★ {barber.rating}</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {selectedBarber && (
              <div className="mt-4">
                <label className="text-sm text-slate-400 mb-1 block">Select Date</label>
                <input type="date" min={todayStr} value={selectedDate} onChange={e => loadSlots(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500" />
                {loading && <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>}
              </div>
            )}
          </motion.div>
        )}

        {step === 4 && selectedBarber && selectedDate && (
          <motion.div key="s4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Select Time</h2>
            <p className="text-slate-400 text-sm">{selectedBarber.name} &mdash; {selectedDate}</p>
            {slots.length === 0 && !loading && (
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 text-center">
                <Clock className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-400">No available slots for this date</p>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {slots.map(slot => (
                <button type="button" key={slot.start} onClick={() => { setSelectedSlot(slot); setStep(5); }}
                  className={`py-3 px-2 rounded-xl text-sm font-medium border transition-colors ${selectedSlot?.start === slot.start ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-white/10 border-white/20 text-slate-300 hover:bg-white/20'}`}>
                  <span className="block">{slot.start}</span>
                  <span className="block text-[10px] opacity-60">- {slot.end?.slice(0, 5)}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 5 && (
          <motion.div key="s5" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
            {bookingError && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-rose-300 text-sm text-center">{bookingError}</div>
            )}
            {bookingResult ? (
              <div className="bg-white/10 backdrop-blur-xl border border-emerald-500/30 rounded-2xl p-6 text-center">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Booking Confirmed!</h2>
                <div className="text-3xl font-mono font-bold text-indigo-400 bg-indigo-500/10 rounded-xl py-3 px-6 inline-block mb-4">{bookingResult.token}</div>
                <div className="space-y-2 text-sm text-slate-300">
                  <p><span className="text-slate-500">Salon:</span> {bookingResult.salon_name}</p>
                  <p><span className="text-slate-500">Service:</span> {bookingResult.service_name}</p>
                  <p><span className="text-slate-500">Barber:</span> {bookingResult.barber_name}</p>
                  <p><span className="text-slate-500">Date:</span> {bookingResult.appointment_date}</p>
                  <p><span className="text-slate-500">Time:</span> {bookingResult.appointment_time?.slice(0, 5)}</p>
                </div>
                <button type="button" onClick={reset} className="mt-6 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-6 rounded-xl transition-colors">Book Another</button>
              </div>
            ) : (
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-semibold text-white">Confirm Booking</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-slate-300"><span>Salon</span><span className="text-white">{selectedSalon?.name}</span></div>
                  <div className="flex justify-between text-slate-300"><span>Service</span><span className="text-white">{selectedService?.name}</span></div>
                  <div className="flex justify-between text-slate-300"><span>Barber</span><span className="text-white">{selectedBarber?.name}</span></div>
                  <div className="flex justify-between text-slate-300"><span>Date</span><span className="text-white">{selectedDate}</span></div>
                  <div className="flex justify-between text-slate-300"><span>Time</span><span className="text-white">{selectedSlot?.start} - {selectedSlot?.end?.slice(0, 5)}</span></div>
                  <div className="flex justify-between text-slate-300 pt-2 border-t border-slate-700"><span>Price</span><span className="text-indigo-400 font-semibold">{'\u20B9'}{selectedService?.price}</span></div>
                </div>
                {variant === 'public' && (
                  <div>
                    <label className="text-sm text-slate-400 mb-1 block">Your Phone Number</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input type="tel" value={phone} onChange={e => { setPhone(e.target.value); setPhoneError(''); }}
                        placeholder="+91 98765 43210"
                        className="w-full bg-white/10 border border-white/20 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-600" />
                    </div>
                    {phoneError && <p className="text-rose-400 text-xs mt-1">{phoneError}</p>}
                  </div>
                )}
                <button type="button" onClick={confirmBooking} disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-6 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading && <Loader2 className="w-5 h-5 animate-spin" />} Confirm Booking
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
