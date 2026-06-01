// Auth context. Envuelve la app y expone usuario actual + login/logout.
// Persiste el usuario en AsyncStorage (en prod usaríamos SecureStore).

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Usuario } from '@/data/types';
import { useRepository } from '@/data';

interface AuthState {
  user: Usuario | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const USER_KEY = 'asfion.auth.user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const repo = useRepository();
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(USER_KEY);
        if (raw) {
          const u: Usuario = JSON.parse(raw);
          setUser(u);
          // Primamos el cache del backend con el user persistido.
          // Sin esto, el primer saveEvento tras un cold-start tira
          // "usuario sin clienteId" porque SupabaseBackend tiene
          // su currentUserCache en null hasta que se ejecute
          // login() o getCurrentUser() (y getCurrentUser() puede
          // demorar un round-trip si la sesión está cacheada solo
          // en el storage de Supabase).
          repo.setCurrentUser(u);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [repo]);

  const login = useCallback(async (email: string, password: string) => {
    const u = await repo.login(email, password);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(u));
    repo.setCurrentUser(u);
    setUser(u);
  }, [repo]);

  const logout = useCallback(async () => {
    await repo.logout();
    await AsyncStorage.removeItem(USER_KEY);
    repo.setCurrentUser(null);
    setUser(null);
  }, [repo]);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth: falta <AuthProvider>');
  return ctx;
}
