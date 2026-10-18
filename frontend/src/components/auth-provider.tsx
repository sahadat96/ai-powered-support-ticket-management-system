'use client';
import {createContext, useCallback, useContext, useEffect, useState, type ReactNode} from 'react';
import {api, ApiError} from '@/lib/api';
import type {User} from '@/lib/types';
interface AuthContextValue {
  user: User|null; loading: boolean; error: string|null; refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
const AuthContext = createContext<AuthContextValue|null>(null);
export function AuthProvider({children}: {children: ReactNode}) {
  const [user, setUser] = useState<User|null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {const result = await api<{user: User}>('/auth/me'); setUser(result.user); setError(null);}
    catch (error) {setUser(null); setError(error instanceof ApiError && error.status === 401 ? null : (error as Error).message);}
    finally {setLoading(false);}
  }, []);
  useEffect(() => {void refresh(); const expire = () => {setUser(null);}; window.addEventListener('session-expired', expire); return () => window.removeEventListener('session-expired', expire);}, [refresh]);
  async function login(email: string, password: string) {const result = await api<{user: User}>('/auth/login', {method: 'POST', body: {email, password}}); setUser(result.user); setError(null);}
  async function register(name: string, email: string, password: string) {const result = await api<{user: User}>('/auth/register', {method: 'POST', body: {name, email, password}}); setUser(result.user); setError(null);}
  async function logout() {await api<void>('/auth/logout', {method: 'POST'}); setUser(null);}
  return <AuthContext.Provider value={{user, loading, error, refresh, login, register, logout}}>{children}</AuthContext.Provider>;
}
export function useAuth() {const context = useContext(AuthContext); if (!context) throw new Error('AuthProvider is required'); return context;}
