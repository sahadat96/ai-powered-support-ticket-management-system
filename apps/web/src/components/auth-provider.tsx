'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, json } from '@/lib/api';
import { User } from '@/lib/types';

const AuthContext = createContext<{user: User | null; loading: boolean; error: string; reload: () => void; signIn: (data: {email: string; password: string; name?: string}, register?: boolean) => Promise<void>; signOut: () => Promise<void>} | null>(null);
export function AuthProvider({children}: {children: React.ReactNode}) {
  const [user, setUser] = useState<User | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const router = useRouter();
  const reload = useCallback(() => {
    setLoading(true); setError('');
    api<User>('/auth/me').then(setUser).catch((e) => {setUser(null); if (e.status !== 401) setError(e.message);}).finally(() => setLoading(false));
  }, []);
  useEffect(() => {reload(); const expired = () => {setUser(null); router.replace('/login');}; window.addEventListener('session-expired', expired); return () => window.removeEventListener('session-expired', expired);}, [reload, router]);
  async function signIn(data: {email: string; password: string; name?: string}, register = false) {const result = await api<{user: User}>(`/auth/${register ? 'register' : 'login'}`, json('POST', data)); setUser(result.user); router.replace('/dashboard');}
  async function signOut() {await api('/auth/logout', json('POST', {})); setUser(null); router.replace('/login');}
  return <AuthContext.Provider value={{user, loading, error, reload, signIn, signOut}}>{children}</AuthContext.Provider>;
}
export function useAuth() {const context = useContext(AuthContext); if (!context) throw new Error('AuthProvider missing'); return context;}
