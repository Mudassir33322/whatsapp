import React, { createContext, useContext, useEffect, useState } from 'react';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  phone?: string;
  role?: string;
  avatarInitials?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'autozap-user';

// Default admin credentials (only used as fallback)
const DEFAULT_EMAIL = 'admin@autozap.com';
const DEFAULT_PASSWORD = 'admin123';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setUser(JSON.parse(saved)); } catch {}
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    if (email.trim().toLowerCase() !== DEFAULT_EMAIL) return false;
    if (password !== DEFAULT_PASSWORD) return false;

    const profile: UserProfile = {
      uid: 'autozap-admin',
      displayName: localStorage.getItem('autozap-displayName') || 'Salon Admin',
      email: DEFAULT_EMAIL,
      phone: localStorage.getItem('autozap-phone') || '',
      role: 'Administrator',
      avatarInitials: (localStorage.getItem('autozap-displayName') || 'SA').split(' ').map(n => n[0]).join('').toUpperCase()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    setUser(profile);
    return true;
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  const updateProfile = (updates: Partial<UserProfile>) => {
    if (!user) return;
    const updated = { ...user, ...updates };
    updated.avatarInitials = updated.displayName.split(' ').map(n => n[0]).join('').toUpperCase();
    if (updates.displayName) localStorage.setItem('autozap-displayName', updates.displayName);
    if (updates.phone) localStorage.setItem('autozap-phone', updates.phone);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setUser(updated);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
