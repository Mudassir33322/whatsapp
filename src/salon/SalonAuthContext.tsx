import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_URL } from '../config';

interface SalonUser {
  id: number;
  name: string;
  email: string;
  owner_name?: string;
  phone?: string;
  cover_image?: string;
  logo?: string;
}

interface SalonAuthContextType {
  salon: SalonUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

const SalonAuthContext = createContext<SalonAuthContextType>(null!);

export function SalonAuthProvider({ children }: { children: React.ReactNode }) {
  const [salon, setSalon] = useState<SalonUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    const savedToken = localStorage.getItem('salon-token');
    const savedSalon = localStorage.getItem('salon-user');
    if (savedToken && savedSalon) {
      setToken(savedToken);
      try { setSalon(JSON.parse(savedSalon)); } catch { localStorage.removeItem('salon-user'); }
      fetch(`${API_URL}/api/salon/auth/me`, {
        headers: { Authorization: `Bearer ${savedToken}` },
        signal: ac.signal,
      }).then(res => {
        if (res.status === 401) {
          localStorage.removeItem('salon-token');
          localStorage.removeItem('salon-user');
          setToken(null);
          setSalon(null);
        }
        setLoading(false);
      }).catch(() => {
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
    return () => ac.abort();
  }, []);

  const login = async (email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch(`${API_URL}/api/salon/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as any));
        return { ok: false, error: res.status === 401 ? 'Invalid email or password' : (data.error || 'Login failed. Please try again.') };
      }
      const data = await res.json();
      localStorage.setItem('salon-token', data.token);
      localStorage.setItem('salon-user', JSON.stringify(data.salon));
      setToken(data.token);
      setSalon(data.salon);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error — please check your connection and try again.' };
    }
  };

  const logout = () => {
    localStorage.removeItem('salon-token');
    localStorage.removeItem('salon-user');
    setToken(null);
    setSalon(null);
  };

  return (
    <SalonAuthContext.Provider value={{ salon, token, loading, login, logout }}>
      {children}
    </SalonAuthContext.Provider>
  );
}

export function useSalonAuth() {
  const ctx = useContext(SalonAuthContext);
  if (!ctx) throw new Error('useSalonAuth must be used within SalonAuthProvider');
  return ctx;
}
