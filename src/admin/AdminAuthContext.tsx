import React, { createContext, useContext, useState, useEffect } from 'react';

interface AdminUser { email: string; name: string; role: 'super_admin' | 'admin' | 'support' | 'viewer'; }

interface AdminAuthContextType {
  admin: AdminUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType>(null!);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('admin-token');
    const savedUser = localStorage.getItem('admin-user');
    if (saved && savedUser) { setToken(saved); setAdmin(JSON.parse(savedUser)); }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) return false;
      localStorage.setItem('admin-token', data.token);
      localStorage.setItem('admin-user', JSON.stringify(data.admin));
      setToken(data.token); setAdmin(data.admin);
      return true;
    } catch { return false; }
  };

  const logout = () => {
    localStorage.removeItem('admin-token'); localStorage.removeItem('admin-user');
    setToken(null); setAdmin(null);
  };

  return (
    <AdminAuthContext.Provider value={{ admin, token, loading, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() { return useContext(AdminAuthContext); }
