import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_URL } from '../config';

interface CustomerUser {
  id?: number;
  name: string;
  phone: string;
  email?: string;
  loyalty_points?: number;
}

interface CustomerAuthContextType {
  customer: CustomerUser | null;
  token: string | null;
  loading: boolean;
  loginPhone: (phone: string) => Promise<{ success: boolean; message: string }>;
  verifyOtp: (phone: string, code: string) => Promise<{ success: boolean; needsPassword?: boolean }>;
  loginPassword: (phone: string, password: string) => Promise<boolean>;
  setPassword: (password: string) => Promise<boolean>;
  logout: () => void;
  customerFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  updateProfile: (data: Partial<CustomerUser>) => Promise<boolean>;
}

const CustomerAuthContext = createContext<CustomerAuthContextType>(null!);

export function CustomerAuthProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<CustomerUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('customer-token');
    localStorage.removeItem('customer-user');
    setToken(null);
    setCustomer(null);
  }, []);

  const customerFetch = useCallback(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const t = localStorage.getItem('customer-token');
    const url = typeof input === 'string' && input.startsWith('/') ? `${API_URL}${input}` : input;
    const res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${t}`,
        ...init?.headers,
      },
    });
    if (res.status === 401) {
      logout();
    }
    return res;
  }, [logout]);

   useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const savedToken = localStorage.getItem('customer-token');
        const savedCustomer = localStorage.getItem('customer-user');
        if (savedToken && savedCustomer) {
          try {
            const res = await fetch(`${API_URL}/api/customer/auth/me`, {
              headers: { Authorization: `Bearer ${savedToken}` },
              signal: ac.signal,
            });
            if (res.ok) {
              const customerData = await res.json();
              setToken(savedToken);
              setCustomer(customerData);
              localStorage.setItem('customer-user', JSON.stringify(customerData));
            } else {
              localStorage.removeItem('customer-token');
              localStorage.removeItem('customer-user');
              setToken(null);
              setCustomer(null);
            }
          } catch (err: any) {
            if (err?.name !== 'AbortError') {
              localStorage.removeItem('customer-token');
              localStorage.removeItem('customer-user');
              setToken(null);
              setCustomer(null);
            }
          }
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, []);

  const loginPhone = async (phone: string): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch(`${API_URL}/api/customer/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      return { success: data.success, message: data.message || '' };
    } catch {
      return { success: false, message: 'Network error' };
    }
  };

  const verifyOtp = async (phone: string, code: string): Promise<{ success: boolean; needsPassword?: boolean }> => {
    try {
      const res = await fetch(`${API_URL}/api/customer/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) return { success: false };
      localStorage.setItem('customer-token', data.token);
      localStorage.setItem('customer-user', JSON.stringify(data.customer));
      setToken(data.token);
      setCustomer(data.customer);
      return { success: true, needsPassword: data.needsPassword };
    } catch {
      return { success: false };
    }
  };

  const loginPassword = async (phone: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_URL}/api/customer/auth/login-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) return false;
      localStorage.setItem('customer-token', data.token);
      localStorage.setItem('customer-user', JSON.stringify(data.customer));
      setToken(data.token);
      setCustomer(data.customer);
      return true;
    } catch {
      return false;
    }
  };

  const setPassword = async (password: string): Promise<boolean> => {
    try {
      const res = await customerFetch('/api/customer/auth/set-password', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  const updateProfile = async (data: Partial<CustomerUser>): Promise<boolean> => {
    try {
      const res = await customerFetch('/api/customer/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      if (!res.ok) return false;
      const updated = await res.json();
      setCustomer(updated);
      localStorage.setItem('customer-user', JSON.stringify(updated));
      return true;
    } catch {
      return false;
    }
  };

  return (
    <CustomerAuthContext.Provider value={{ customer, token, loading, loginPhone, verifyOtp, loginPassword, setPassword, logout, customerFetch, updateProfile }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  return useContext(CustomerAuthContext);
}
