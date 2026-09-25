import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_URL } from '../config';

interface AdminUser { email: string; name: string; role: 'super_admin' | 'admin' | 'support' | 'viewer'; }

interface AdminAuthContextType {
  admin: AdminUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  adminFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

const AdminAuthContext = createContext<AdminAuthContextType>(null!);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('admin-token'); localStorage.removeItem('admin-user');
    setToken(null); setAdmin(null);
  }, []);

  const adminFetch = useCallback(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const t = localStorage.getItem('admin-token');
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
        const saved = localStorage.getItem('admin-token');
        const savedUser = localStorage.getItem('admin-user');
        if (saved && savedUser) {
          try {
            const res = await fetch(`${API_URL}/api/admin/auth/me`, {
              headers: { Authorization: `Bearer ${saved}` },
              signal: ac.signal,
            });
            if (res.ok) {
              const userData = await res.json();
              setToken(saved);
              setAdmin(userData);
              localStorage.setItem('admin-user', JSON.stringify(userData));
            } else if (res.status === 401) {
              localStorage.removeItem('admin-token');
              localStorage.removeItem('admin-user');
            }
          } catch (err: any) {
            if (err?.name !== 'AbortError') {
              // Network error — token may still be valid, preserve session
              setToken(saved);
              if (savedUser) try { setAdmin(JSON.parse(savedUser)); } catch {}
            }
          }
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_URL}/api/admin/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) return false;
      const data = await res.json();
      localStorage.setItem('admin-token', data.token);
      localStorage.setItem('admin-user', JSON.stringify(data.admin));
      setToken(data.token); setAdmin(data.admin);
      return true;
    } catch (err) {
      console.error('[AdminAuth] Login failed:', err);
      return false;
    }
  };

  return (
    <AdminAuthContext.Provider value={{ admin, token, loading, login, logout, adminFetch }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}
