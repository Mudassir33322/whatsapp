import React, { createContext, useContext, useState, useEffect } from 'react';

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
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const SalonAuthContext = createContext<SalonAuthContextType>(null!);

export function SalonAuthProvider({ children }: { children: React.ReactNode }) {
  const [salon, setSalon] = useState<SalonUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('salon-token');
    const savedSalon = localStorage.getItem('salon-user');
    if (savedToken && savedSalon) {
      setToken(savedToken);
      setSalon(JSON.parse(savedSalon));
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/salon/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) return false;
      localStorage.setItem('salon-token', data.token);
      localStorage.setItem('salon-user', JSON.stringify(data.salon));
      setToken(data.token);
      setSalon(data.salon);
      return true;
    } catch {
      return false;
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
  return useContext(SalonAuthContext);
}
