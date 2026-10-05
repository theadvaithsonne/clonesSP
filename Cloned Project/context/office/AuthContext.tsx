'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { officeApi as api } from '@/lib/office-api';

export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  officeId?: string;
  role: 'owner' | 'admin' | 'member';
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  signup(name: string, email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<AuthUser | null>>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function OfficeAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount: try to restore session via refresh token cookie
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.post('/api/auth/refresh');
        localStorage.setItem('office_access_token', data.accessToken);
        const me = await api.get('/api/auth/me');
        setUser(me.data.user);
      } catch {
        localStorage.removeItem('office_access_token');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Listen for forced logout from the axios interceptor (refresh failed mid-session)
  useEffect(() => {
    function handleAuthLogout() {
      setUser(null);
    }
    window.addEventListener('auth:logout', handleAuthLogout);
    return () => window.removeEventListener('auth:logout', handleAuthLogout);
  }, []);

  async function login(email: string, password: string) {
    const { data } = await api.post('/api/auth/login', { email, password });
    localStorage.setItem('office_access_token', data.accessToken);
    setUser(data.user);
  }

  async function signup(name: string, email: string, password: string) {
    const { data } = await api.post('/api/auth/register', { name, email, password });
    localStorage.setItem('office_access_token', data.accessToken);
    setUser(data.user);
  }

  async function logout() {
    await api.post('/api/auth/logout').catch(() => {});
    localStorage.removeItem('office_access_token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useOfficeAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useOfficeAuth must be used within OfficeAuthProvider');
  return ctx;
}
