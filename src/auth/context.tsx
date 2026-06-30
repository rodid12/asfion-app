// Auth context. Envuelve la app y expone usuario actual + login/logout.
//
// Persistencia: SecureStore (Keychain en iOS, Keystore en Android — ambos
// encriptados con la clave del device). Migración hecha post-audit
// 27-jun-2026: antes se usaba AsyncStorage que es sandboxed pero plano,
// y un device rooteado/jailbroken puede leer el blob de session.
//
// Migración invisible para el usuario: si hay data vieja en AsyncStorage
// la lee una vez, la copia a SecureStore y borra de AsyncStorage. Después
// de la primera ejecución, SecureStore es el único storage.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
// @ts-ignore — expo-secure-store viene con Expo 54 + ya está en deps
import * as SecureStore from 'expo-secure-store';
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

// Wrapper de SecureStore con fallback transparente a AsyncStorage si
// SecureStore no está disponible (ej. web). En mobile siempre va a
// SecureStore.
async function storageGet(key: string): Promise<string | null> {
  try {
    const v = await SecureStore.getItemAsync(key);
    if (v != null) return v;
  } catch { /* fallback */ }
  // Migración silenciosa: si todavía tenemos data en AsyncStorage,
  // copiarla a SecureStore y borrar el origen.
  const legacy = await AsyncStorage.getItem(key);
  if (legacy) {
    try { await SecureStore.setItemAsync(key, legacy); } catch { /* ignore */ }
    try { await AsyncStorage.removeItem(key); } catch { /* ignore */ }
  }
  return legacy;
}

async function storageSet(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Si SecureStore no está (web), caer a AsyncStorage como último recurso.
    await AsyncStorage.setItem(key, value);
  }
}

async function storageRemove(key: string): Promise<void> {
  try { await SecureStore.deleteItemAsync(key); } catch { /* ignore */ }
  try { await AsyncStorage.removeItem(key); } catch { /* ignore */ }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const repo = useRepository();
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const raw = await storageGet(USER_KEY);
        if (cancelado) return;
        if (raw) {
          const u: Usuario = JSON.parse(raw);
          setUser(u);
          // Primamos el cache del backend con el user persistido (ver
          // explicación abajo del por qué).
          repo.setCurrentUser(u);
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, [repo]);

  const login = useCallback(async (email: string, password: string) => {
    const u = await repo.login(email, password);
    await storageSet(USER_KEY, JSON.stringify(u));
    repo.setCurrentUser(u);
    setUser(u);
  }, [repo]);

  const logout = useCallback(async () => {
    await repo.logout();
    await storageRemove(USER_KEY);
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
